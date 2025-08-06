const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('./database');
const OVHClient = require('./ovhClient');
require('dotenv').config();

// Vérification des variables d'environnement OVH au démarrage
const requiredEnvVars = ['OVH_APP_KEY', 'OVH_APP_SECRET', 'OVH_CONSUMER_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Variables d\'environnement OVH manquantes:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\n💡 Veuillez configurer ces variables dans votre fichier .env');
  console.error('   Exemple:');
  console.error('   OVH_APP_KEY=your_app_key');
  console.error('   OVH_APP_SECRET=your_app_secret');
  console.error('   OVH_CONSUMER_KEY=your_consumer_key');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database();
const ovhClient = new OVHClient();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Variables globales pour le monitoring
let isMonitoring = false;
let monitoringInterval = null;

// Fonction pour logger avec base de données
async function logMessage(level, message, domain = null) {
  console.log(`[${new Date().toLocaleString()}] ${level.toUpperCase()}: ${message}`);
  try {
    await db.addLog(level, message, domain);
  } catch (error) {
    console.error('Erreur lors de l\'ajout du log:', error);
  }
}

// Fonction de monitoring des domaines
async function monitorDomains() {
  try {
    const domains = await db.getAllDomains();
    const activeDomains = domains.filter(d => d.monitoring_enabled);

    if (activeDomains.length === 0) {
      await logMessage('info', 'Aucun domaine actif à surveiller');
      return;
    }

    await logMessage('info', `Vérification de ${activeDomains.length} domaine(s)...`);

    for (const domain of activeDomains) {
      try {
        // D'abord récupérer les informations d'expiration
        const expirationInfo = await ovhClient.getDomainExpirationInfo(domain.domain);
        if (expirationInfo) {
          await db.updateDomainExpirationInfo(
            domain.id,
            expirationInfo.expiryDate,
            expirationInfo.estimatedReleaseDate,
            expirationInfo.daysUntilExpiry,
            expirationInfo.registrar
          );
        }

        const isAvailable = await ovhClient.isDomainAvailable(domain.domain);

        // Enregistrer la vérification
        await db.addDomainCheck(domain.id, isAvailable ? 'available' : 'unavailable', isAvailable);

        if (isAvailable) {
          await logMessage('success', `🎯 DOMAINE DISPONIBLE: ${domain.domain}`, domain.domain);
          await db.updateDomainStatus(domain.id, 'available');

          // Achat automatique si activé
          if (domain.auto_purchase_enabled) {
            await logMessage('info', `Tentative d'achat automatique pour ${domain.domain}...`, domain.domain);

            const purchaseResult = await ovhClient.purchaseDomain(domain.domain);

            if (purchaseResult.success) {
              await logMessage('success', `✅ Achat réussi pour ${domain.domain}! ID: ${purchaseResult.orderId}`, domain.domain);
              await db.addPurchase(domain.id, domain.domain, purchaseResult.orderId, 'completed');
              await db.updateDomainStatus(domain.id, 'purchased');
            } else {
              await logMessage('error', `❌ Échec de l'achat pour ${domain.domain}: ${purchaseResult.error}`, domain.domain);
              await db.addPurchase(domain.id, domain.domain, null, 'failed', null, purchaseResult.error);
            }
          }
        } else {
          await db.updateDomainStatus(domain.id, 'unavailable');
          await logMessage('info', `${domain.domain} - Non disponible`, domain.domain);
        }

        // Délai entre les vérifications
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        await logMessage('error', `Erreur lors de la vérification de ${domain.domain}: ${error.message}`, domain.domain);
        await db.addDomainCheck(domain.id, 'error', false, error.message);
        await db.updateDomainStatus(domain.id, 'error');
      }
    }

    await logMessage('info', 'Vérification terminée');
  } catch (error) {
    await logMessage('error', `Erreur générale du monitoring: ${error.message}`);
  }
}

// Routes API

// Dashboard - Statistiques générales
app.get('/api/dashboard', async (req, res) => {
  try {
    const domains = await db.getAllDomains();
    const purchases = await db.getAllPurchases();
    const logs = await db.getRecentLogs(10);

    // Récupérer le solde OVH
    const balanceInfo = await ovhClient.getAccountBalance();

    const stats = {
      totalDomains: domains.length,
      activeDomains: domains.filter(d => d.monitoring_enabled).length,
      availableDomains: domains.filter(d => d.status === 'available').length,
      purchasedDomains: purchases.filter(p => p.status === 'completed').length,
      isMonitoring,
      ovhBalance: balanceInfo,
      lastCheck: domains.length > 0 ? Math.max(...domains.map(d => new Date(d.last_check || 0).getTime())) : null
    };

    res.json({ stats, recentLogs: logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Gestion des domaines
app.get('/api/domains', async (req, res) => {
  try {
    const domains = await db.getAllDomains();
    res.json(domains);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/domains', async (req, res) => {
  try {
    const { domain, monitoringEnabled = true, autoPurchaseEnabled = false } = req.body;

    if (!domain) {
      return res.status(400).json({ error: 'Le nom de domaine est requis' });
    }

    const id = await db.addDomain(domain, monitoringEnabled, autoPurchaseEnabled);
    await logMessage('info', `Nouveau domaine ajouté: ${domain}`);

    res.json({ id, message: 'Domaine ajouté avec succès' });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Ce domaine existe déjà' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.put('/api/domains/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { monitoringEnabled, autoPurchaseEnabled } = req.body;

    await db.updateDomainSettings(id, monitoringEnabled, autoPurchaseEnabled);
    await logMessage('info', `Paramètres mis à jour pour le domaine ID: ${id}`);

    res.json({ message: 'Paramètres mis à jour' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/domains/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.deleteDomain(id);
    await logMessage('info', `Domaine supprimé ID: ${id}`);

    res.json({ message: 'Domaine supprimé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Contrôle du monitoring
app.post('/api/monitoring/start', async (req, res) => {
  try {
    if (isMonitoring) {
      return res.json({ message: 'Le monitoring est déjà actif' });
    }

    isMonitoring = true;
    await logMessage('success', '🚀 Démarrage du monitoring automatique');

    // Première vérification immédiate
    await monitorDomains();

    // Programmer les vérifications périodiques (60 secondes)
    monitoringInterval = setInterval(monitorDomains, 60000);

    res.json({ message: 'Monitoring démarré' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/monitoring/stop', async (req, res) => {
  try {
    isMonitoring = false;
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      monitoringInterval = null;
    }

    await logMessage('warning', '🛑 Arrêt du monitoring automatique');
    res.json({ message: 'Monitoring arrêté' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/monitoring/check', async (req, res) => {
  try {
    await logMessage('info', '🔍 Vérification manuelle déclenchée');
    await monitorDomains();
    res.json({ message: 'Vérification effectuée' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analytics
app.get('/api/analytics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];

    const analyticsData = await db.getAnalyticsData(start, end);
    res.json(analyticsData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Achats
app.get('/api/purchases', async (req, res) => {
  try {
    const purchases = await db.getAllPurchases();
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logs
app.get('/api/logs', async (req, res) => {
  try {
    const logs = await db.getRecentLogs(100);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Routes pour servir les pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Test de connexion OVH
app.get('/api/test-ovh', async (req, res) => {
  try {
    console.log('🔍 Début du test de connexion OVH...');
    console.log('📋 Variables d\'environnement:', {
      OVH_APP_KEY: process.env.OVH_APP_KEY ? '✅ Défini' : '❌ Manquant',
      OVH_APP_SECRET: process.env.OVH_APP_SECRET ? '✅ Défini' : '❌ Manquant',
      OVH_CONSUMER_KEY: process.env.OVH_CONSUMER_KEY ? '✅ Défini' : '❌ Manquant'
    });

    const connectionTest = await ovhClient.testConnection();
    console.log('🔗 Résultat test connexion:', connectionTest);

    const balanceInfo = await ovhClient.getAccountBalance();
    console.log('💰 Résultat test solde:', balanceInfo);

    res.json({
      connection: connectionTest,
      balance: balanceInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Erreur complète du test OVH:', error);
    res.status(500).json({
      error: error.message,
      connection: { success: false, error: error.message },
      balance: { balance: null, error: error.message }
    });
  }
});

app.get('/analytics', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'analytics.html'));
});

app.get('/purchases', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'purchases.html'));
});

// Démarrage du serveur
app.listen(PORT, async () => {
  await logMessage('success', `🌐 Domaine Sniper SaaS démarré sur http://localhost:${PORT}`);
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    🎯 DOMAINE SNIPER SAAS                   ║
║                                                              ║
║  Dashboard:   http://localhost:${PORT}                           ║
║  Analytics:   http://localhost:${PORT}/analytics                 ║
║  Purchases:   http://localhost:${PORT}/purchases                 ║
║                                                              ║
║  Status: ✅ Prêt à surveiller vos domaines                   ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

// Gestion propre de l'arrêt
process.on('SIGINT', async () => {
  console.log('\n🛑 Arrêt de Domaine Sniper SaaS...');
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }
  db.close();
  process.exit(0);
});
