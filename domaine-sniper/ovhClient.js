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
        await logMessage('info', `🔄 Vérification de ${domain.domain}...`, domain.domain);
        
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
        
        // Enregistrer le résultat de la vérification
        const checkStatus = isAvailable ? 'available' : 'unavailable';
        await db.addDomainCheck(domain.id, checkStatus, isAvailable);
        await logMessage('info', `✅ ${domain.domain} - ${checkStatus.toUpperCase()}`, domain.domain);
        
        if (isAvailable) {
          await logMessage('success', `🎯 DOMAINE DISPONIBLE: ${domain.domain}`, domain.domain);
          await db.updateDomainStatus(domain.id, 'available');
          
          if (domain.auto_purchase_enabled) {
            await logMessage('info', `🛒 ACHAT AUTOMATIQUE ACTIVÉ pour ${domain.domain}...`, domain.domain);
            
            try {
              const purchaseResult = await ovhClient.purchaseDomain(domain.domain);
            
              if (purchaseResult.success) {
                await logMessage('success', `✅ ACHAT RÉUSSI pour ${domain.domain}! ID: ${purchaseResult.orderId}`, domain.domain);
                await db.updateDomainStatus(domain.id, 'purchased');
      // NOUVELLE APPROCHE : Utiliser l'API /order/domain directement
      console.log(`🎯 Tentative d'achat direct via /order/domain...`);
      
      // 1. Vérifier d'abord que le domaine est toujours disponible
      const stillAvailable = await this.isDomainAvailable(domain);
      if (!stillAvailable) {
        console.log(`❌ Domaine ${domain} n'est plus disponible au moment de l'achat`);
        return {
          success: false,
          error: 'Domaine plus disponible au moment de l\'achat'
        };
      }
      
      console.log(`✅ Domaine ${domain} confirmé disponible, procédure d'achat...`);
      
      // 2. Méthode alternative : Créer un panier pré-assigné
      let cart;
      try {
        console.log(`📦 Création d'un panier pré-assigné...`);
        cart = await this.client.requestPromised('POST', '/order/cart', {
          ovhSubsidiary: 'FR',
          assign: true  // Assigner directement à la création
        });
        console.log(`✅ Panier pré-assigné créé: ${cart.cartId}`);
      } catch (cartError) {
        console.log(`⚠️ Échec panier pré-assigné, tentative classique...`);
        cart = await this.client.requestPromised('POST', '/order/cart', {
          ovhSubsidiary: 'FR'
        });
        console.log(`📦 Panier classique créé: ${cart.cartId}`);
      }
      
      // 3. Ajouter le domaine au panier
      console.log(`➕ Ajout du domaine ${domain} au panier...`);
      const cartItem = await this.client.requestPromised('POST', `/order/cart/${cart.cartId}/domain`, {
        domain: domain,
        duration: 'P1Y'
      });
      console.log(`✅ Domaine ajouté: ${cartItem.itemId}`);
      
      // 4. Assigner le panier si pas déjà fait
      try {
        console.log(`🔗 Vérification de l'assignation du panier...`);
        const cartInfo = await this.client.requestPromised('GET', `/order/cart/${cart.cartId}`);
        
        if (!cartInfo.assign) {
          console.log(`🔗 Assignation du panier nécessaire...`);
          await this.client.requestPromised('POST', `/order/cart/${cart.cartId}/assign`);
          console.log(`✅ Panier assigné avec succès`);
        } else {
          console.log(`✅ Panier déjà assigné`);
        }
      } catch (assignError) {
        console.log(`⚠️ Erreur assignation:`, assignError.message);
        // Continuer quand même, parfois ça marche sans assignation explicite
      }
      
      // 5. Attendre un peu pour que l'assignation soit effective
      console.log(`⏳ Attente de 2 secondes pour stabilisation...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 6. Valider le panier (checkout)
      console.log(`💳 Validation finale du panier...`);
      const order = await this.client.requestPromised('POST', `/order/cart/${cart.cartId}/checkout`);
      
      console.log(`🎉 ACHAT RÉUSSI !`);
      console.log(`📋 ID Commande: ${order.orderId}`);
      console.log(`💰 Prix: ${order.prices ? order.prices.withTax.text : 'N/A'}`);
        await db.updateDomainStatus(domain.id, 'error');
      }
    }
    
    await logMessage('success', `🏁 Vérification terminée pour ${activeDomains.length} domaine(s)`);
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

// Route de diagnostic HTML
app.get('/debug-html', (req, res) => {
  try {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    console.log('🔍 Debug HTML - Chemin:', indexPath);
    
    if (!fs.existsSync(indexPath)) {
      return res.send('<h1>ERREUR: index.html non trouvé</h1>');
    }
    
    const htmlContent = fs.readFileSync(indexPath, 'utf8');
    console.log('📄 Taille du fichier HTML:', htmlContent.length, 'caractères');
    console.log('🔤 Premiers 200 caractères:', htmlContent.substring(0, 200));
    
    // Vérifier si le HTML est valide
    const hasDoctype = htmlContent.includes('<!DOCTYPE');
    const hasHtml = htmlContent.includes('<html');
    const hasHead = htmlContent.includes('<head>');
    const hasBody = htmlContent.includes('<body>');
    
    res.json({
      fileExists: true,
      fileSize: htmlContent.length,
      hasDoctype: hasDoctype,
      hasHtml: hasHtml,
      hasHead: hasHead,
      hasBody: hasBody,
      firstChars: htmlContent.substring(0, 500),
      lastChars: htmlContent.substring(htmlContent.length - 200)
    });
    
  } catch (error) {
    console.error('❌ Erreur debug HTML:', error);
    res.json({ error: error.message });
  }
});

// Route HTML simple pour test
app.get('/simple', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Simple</title>
    </head>
    <body>
      <h1>🎯 Test Simple Réussi !</h1>
      <p>Si vous voyez ceci, le serveur fonctionne parfaitement.</p>
      <p>Timestamp: ${new Date().toISOString()}</p>
    </body>
    </html>
  `);
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
        price: order.prices ? order.prices.withTax.value : null,
        priceText: order.prices ? order.prices.withTax.text : null
    }
    
    const { domain, monitoringEnabled = true, autoPurchaseEnabled = false } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'Le nom de domaine est requis' });
    }
    
    const id = await db.addDomain(domain, monitoringEnabled, autoPurchaseEnabled);
    await logMessage('info', `Nouveau domaine ajouté: ${domain}`);
        class: error.class,
        stack: error.stack
    res.json({ id, message: 'Domaine ajouté avec succès' });
  } catch (error) {
      // Messages d'erreur plus clairs
      let errorMessage = error.message || 'Erreur inconnue lors de l\'achat';
      
      if (error.message && error.message.includes('not been granted')) {
        errorMessage = 'Permissions insuffisantes - Vérifiez votre ConsumerKey OVH';
      } else if (error.message && error.message.includes('cart hasn\'t been assigned')) {
        errorMessage = 'Erreur d\'assignation du panier OVH';
      } else if (error.message && error.message.includes('not available')) {
        errorMessage = 'Domaine plus disponible au moment de l\'achat';
      }
      
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Ce domaine existe déjà' });
        error: errorMessage,
        details: {
          httpCode: error.httpCode,
          originalError: error.message
        }
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
