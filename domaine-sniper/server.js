const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Database = require('./database');
const OVHClient = require('./ovhClient');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Variables globales
let db;
let ovhClient;
let isMonitoring = false;
let monitoringInterval = null;

// Middleware
app.use(cors());
app.use(express.json());

// Fonction d'initialisation
function initializeServices() {
  try {
    console.log('🔍 Vérification des variables d\'environnement OVH...');
    console.log('OVH_APP_KEY présent:', !!process.env.OVH_APP_KEY);
    console.log('OVH_APP_SECRET présent:', !!process.env.OVH_APP_SECRET);
    console.log('OVH_CONSUMER_KEY présent:', !!process.env.OVH_CONSUMER_KEY);
    
    if (process.env.OVH_APP_KEY) {
      console.log('OVH_APP_KEY commence par:', process.env.OVH_APP_KEY.substring(0, 8) + '...');
    }
    
    const requiredEnvVars = ['OVH_APP_KEY', 'OVH_APP_SECRET', 'OVH_CONSUMER_KEY'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error('❌ Variables d\'environnement OVH manquantes:', missingVars);
      console.error('💡 Vérifiez l\'onglet Variables dans Railway');
      // Initialiser quand même la base de données
      db = new Database();
      console.log('⚠️ Base de données initialisée sans OVH');
      return false;
    }
    
    db = new Database();
    ovhClient = new OVHClient();
    console.log('✅ Services initialisés avec succès');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error.message);
    // Essayer d'initialiser au moins la base de données
    try {
      if (!db) db = new Database();
      console.log('⚠️ Base de données initialisée malgré l\'erreur');
    } catch (dbError) {
      console.error('❌ Impossible d\'initialiser la base de données:', dbError.message);
    }
    return false;
  }
}

// Fonction de logging
async function logMessage(level, message, domain = null) {
  console.log(`[${new Date().toLocaleString()}] ${level.toUpperCase()}: ${message}`);
  try {
    if (db) await db.addLog(level, message, domain);
  } catch (error) {
    console.error('Erreur lors de l\'ajout du log:', error);
  }
}

// Fonction de monitoring
async function monitorDomains() {
  try {
    if (!db || !ovhClient) return;
    
    const domains = await db.getAllDomains();
    const activeDomains = domains.filter(d => d.monitoring_enabled);
    
    if (activeDomains.length === 0) {
      await logMessage('info', 'Aucun domaine actif à surveiller');
      return;
    }

    await logMessage('info', `Vérification de ${activeDomains.length} domaine(s)...`);

    for (const domain of activeDomains) {
      try {
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
        await db.addDomainCheck(domain.id, isAvailable ? 'available' : 'unavailable', isAvailable);
        
        if (isAvailable) {
          await logMessage('success', `🎯 DOMAINE DISPONIBLE: ${domain.domain}`, domain.domain);
          await db.updateDomainStatus(domain.id, 'available');
          
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

// Routes statiques - SERVIR LES FICHIERS HTML DIRECTEMENT
app.get('/', (req, res) => {
  try {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    console.log('🏠 Serving index.html from:', indexPath);
    
    if (fs.existsSync(indexPath)) {
      console.log('✅ index.html found, reading content');
      const htmlContent = fs.readFileSync(indexPath, 'utf8');
      console.log('✅ HTML content read, sending to browser');
      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(htmlContent);
    } else {
      console.error('❌ index.html not found at:', indexPath);
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Domaine Sniper - Erreur</title></head>
        <body>
        <h1>Fichier non trouvé</h1>
        <p>Le fichier index.html n'existe pas à: ${indexPath}</p>
        <p><a href="/test">Tester le serveur</a></p>
        </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('❌ Error in / route:', error);
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Domaine Sniper - Erreur</title></head>
      <body>
        <h1>🎯 Domaine Sniper</h1>
        <p>Erreur: ${error.message}</p>
        <p><a href="/test">Diagnostics</a></p>
      </body>
      </html>
    `);
  }
});

app.get('/analytics', (req, res) => {
  try {
    const analyticsPath = path.join(__dirname, 'public', 'analytics.html');
    if (fs.existsSync(analyticsPath)) {
      res.sendFile(analyticsPath);
    } else {
      res.status(404).send('<h1>Analytics non disponible</h1><p><a href="/">Retour</a></p>');
    }
  } catch (error) {
    console.error('❌ Error in /analytics route:', error);
    res.status(500).send('Erreur serveur');
  }
});

app.get('/purchases', (req, res) => {
  try {
    const purchasesPath = path.join(__dirname, 'public', 'purchases.html');
    if (fs.existsSync(purchasesPath)) {
      res.sendFile(purchasesPath);
    } else {
      res.status(404).send('<h1>Purchases non disponible</h1><p><a href="/">Retour</a></p>');
    }
  } catch (error) {
    console.error('❌ Error in /purchases route:', error);
    res.status(500).send('Erreur serveur');
  }
});

// Route de test
app.get('/test', (req, res) => {
  const publicPath = path.join(__dirname, 'public');
  let files = [];
  
  try {
    files = fs.readdirSync(publicPath);
  } catch (e) {
    files = ['Erreur lecture dossier: ' + e.message];
  }
  
  res.json({ 
    message: 'Serveur fonctionne !', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    publicPath: publicPath,
    files: files,
    indexExists: fs.existsSync(path.join(publicPath, 'index.html')),
    servicesInitialized: !!(db && ovhClient)
  });
});

// Routes API
app.get('/api/dashboard', async (req, res) => {
  try {
    // Toujours retourner des données, même si les services ne sont pas initialisés
    let domains = [];
    let purchases = [];
    let logs = [];
    let balanceInfo = { balance: null, error: 'Services non initialisés' };
    
    if (db && ovhClient) {
      domains = await db.getAllDomains();
      purchases = await db.getAllPurchases();
      logs = await db.getRecentLogs(10);
      balanceInfo = await ovhClient.getAccountBalance();
    } else {
      console.log('⚠️ Services non initialisés, retour de données par défaut');
    }
    
    const stats = {
      totalDomains: domains.length,
      activeDomains: domains.filter(d => d.monitoring_enabled).length,
      availableDomains: domains.filter(d => d.status === 'available').length,
      purchasedDomains: purchases.filter(p => p.status === 'completed').length,
      isMonitoring,
      ovhBalance: balanceInfo,
      lastCheck: domains.length > 0 ? Math.max(...domains.map(d => new Date(d.last_check || 0).getTime())) : null,
      servicesReady: !!(db && ovhClient)
    };
    
    res.json({ 
      stats, 
      recentLogs: logs,
      message: db && ovhClient ? 'Services prêts' : 'Configurez vos variables OVH pour activer toutes les fonctionnalités'
    });
  } catch (error) {
    console.error('❌ Error in /api/dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/domains', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Base de données non initialisée' });
    }
    
    const domains = await db.getAllDomains();
    res.json(domains);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/domains', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Base de données non initialisée' });
    }
    
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
    if (!db) {
      return res.status(503).json({ error: 'Base de données non initialisée' });
    }
    
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
    if (!db) {
      return res.status(503).json({ error: 'Base de données non initialisée' });
    }
    
    const { id } = req.params;
    await db.deleteDomain(id);
    await logMessage('info', `Domaine supprimé ID: ${id}`);
    
    res.json({ message: 'Domaine supprimé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/monitoring/start', async (req, res) => {
  try {
    if (!db || !ovhClient) {
      return res.status(503).json({ error: 'Services non initialisés' });
    }
    
    if (isMonitoring) {
      return res.json({ message: 'Le monitoring est déjà actif' });
    }
    
    isMonitoring = true;
    await logMessage('success', '🚀 Démarrage du monitoring automatique');
    
    await monitorDomains();
    monitoringInterval = setInterval(monitorDomains, 60000);
    
    res.json({ message: 'Monitoring démarré' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/monitoring/stop', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Base de données non initialisée' });
    }
    
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
    if (!db || !ovhClient) {
      return res.status(503).json({ error: 'Services non initialisés' });
    }
    
    await logMessage('info', '🔍 Vérification manuelle déclenchée');
    await monitorDomains();
    res.json({ message: 'Vérification effectuée' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Base de données non initialisée' });
    }
    
    const { startDate, endDate } = req.query;
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];
    
    const analyticsData = await db.getAnalyticsData(start, end);
    res.json(analyticsData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/purchases', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Base de données non initialisée' });
    }
    
    const purchases = await db.getAllPurchases();
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Base de données non initialisée' });
    }
    
    const logs = await db.getRecentLogs(100);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/test-ovh', async (req, res) => {
  try {
    if (!ovhClient) {
      return res.status(503).json({ error: 'Client OVH non initialisé' });
    }
    
    console.log('🔍 Début du test de connexion OVH...');
    
    const connectionTest = await ovhClient.testConnection();
    const balanceInfo = await ovhClient.getAccountBalance();
    
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

// Démarrage du serveur
app.listen(PORT, async () => {
  console.log(`🌐 Serveur démarré sur le port ${PORT}`);
  
  const initialized = initializeServices();
  
  if (initialized) {
    await logMessage('success', `🌐 Domaine Sniper SaaS démarré sur le port ${PORT}`);
  } else {
    console.log('⚠️ Serveur démarré mais services non initialisés - vérifiez les variables d\'environnement');
  }
  
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    🎯 DOMAINE SNIPER SAAS                   ║
║                                                              ║
║  Status: ${initialized ? '✅ Prêt' : '⚠️ Variables manquantes'}                                    ║
║  Port: ${PORT}                                                ║
║  Public: ${path.join(__dirname, 'public')}                   ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

// Gestion propre de l'arrêt
process.on('SIGINT', async () => {
  console.log('\n🛑 Arrêt de Domaine Sniper SaaS...');
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }
  if (db) {
    db.close();
  }
  process.exit(0);
});
