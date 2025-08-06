const fs = require('fs');
const path = require('path');
const OVHClient = require('./ovhClient');
require('dotenv').config();

// Configuration
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL) || 60000; // 60 secondes par défaut
const DOMAINS_FILE = path.join(__dirname, 'domains.json');

// Initialisation du client OVH
const ovhClient = new OVHClient();

/**
 * Lit la liste des domaines à surveiller depuis domains.json
 * @returns {Array<string>} - Liste des domaines
 */
function loadDomains() {
  try {
    if (!fs.existsSync(DOMAINS_FILE)) {
      console.warn('⚠️ Fichier domains.json non trouvé, création d\'un exemple...');
      fs.writeFileSync(DOMAINS_FILE, JSON.stringify([
        'exemple-domaine1.com',
        'exemple-domaine2.net'
      ], null, 2));
    }

    const domainsData = fs.readFileSync(DOMAINS_FILE, 'utf8');
    const domains = JSON.parse(domainsData);

    if (!Array.isArray(domains) || domains.length === 0) {
      throw new Error('Le fichier domains.json doit contenir un tableau non vide de domaines');
    }

    return domains;
  } catch (error) {
    console.error('❌ Erreur lors du chargement des domaines:', error.message);
    process.exit(1);
  }
}

/**
 * Vérifie tous les domaines et achète ceux qui sont disponibles
 */
async function checkAndPurchaseDomains() {
  const domains = loadDomains();
  const timestamp = new Date().toLocaleString('fr-FR');

  console.log(`\n🔄 [${timestamp}] Vérification de ${domains.length} domaine(s)...`);

  for (const domain of domains) {
    try {
      const isAvailable = await ovhClient.isDomainAvailable(domain);

      if (isAvailable) {
        console.log(`🎯 Domaine disponible détecté: ${domain}`);
        console.log(`⏰ Heure: ${timestamp}`);
        console.log(`🤖 Tentative d'achat automatique en cours...`);

        // Tentative d'achat automatique
        const purchaseResult = await ovhClient.purchaseDomain(domain);

        if (purchaseResult.success) {
          console.log(`✅ Achat réussi pour ${domain}!`);
          console.log(`📋 ID Commande: ${purchaseResult.orderId}`);
          console.log(`💰 Le domaine a été acheté automatiquement!`);

          // Retirer le domaine de la liste de surveillance
          const updatedDomains = domains.filter(d => d !== domain);
          fs.writeFileSync(DOMAINS_FILE, JSON.stringify(updatedDomains, null, 2));
          console.log(`📝 Domaine ${domain} retiré de la liste de surveillance`);

        } else {
          console.error(`❌ Échec de l'achat pour ${domain}:`, purchaseResult.error);
          console.log(`⚠️ Vérification manuelle requise!`);
        }
      } else {
        console.log(`⏳ ${domain} - Toujours non disponible`);
      }

      // Petit délai entre les vérifications pour éviter de surcharger l'API
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`❌ Erreur lors de la vérification de ${domain}:`, error.message);
    }
  }

  console.log(`✅ [${timestamp}] Vérification terminée\n`);
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🚀 Démarrage de Domaine Sniper...\n');

  // Vérification des variables d'environnement
  const requiredEnvVars = [
    'OVH_APP_KEY',
    'OVH_APP_SECRET',
    'OVH_CONSUMER_KEY'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ Variables d\'environnement manquantes:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\n💡 Vérifiez votre fichier .env');

    if (missingVars.includes('OVH_CONSUMER_KEY')) {
      console.error('🔑 Pour générer un ConsumerKey, exécutez: npm run generate-key');
    }

    process.exit(1);
  }

  // Chargement des domaines
  const domains = loadDomains();
  console.log(`📋 ${domains.length} domaine(s) chargé(s) pour la surveillance:`);
  domains.forEach((domain, index) => {
    console.log(`   ${index + 1}. ${domain}`);
  });

  console.log(`\n⏱️ Surveillance active - Vérification toutes les ${CHECK_INTERVAL / 1000} secondes`);
  console.log('💡 Utilisez Ctrl+C pour arrêter le programme\n');

  // Première vérification immédiate
  await checkAndPurchaseDomains();

  // Programmer les vérifications périodiques
  setInterval(checkAndPurchaseDomains, CHECK_INTERVAL);
}

// Gestion des signaux d'arrêt
process.on('SIGINT', async () => {
  console.log('\n🛑 Arrêt de Domaine Sniper...');
  console.log('⏰ La surveillance des domaines est interrompue.');
  process.exit(0);
});

// Gestion des erreurs non capturées
process.on('uncaughtException', async (error) => {
  console.error('❌ Erreur non capturée:', error);
  console.error('⚠️ Le programme va redémarrer automatiquement.');
  process.exit(1);
});

// Démarrage de l'application
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
}

module.exports = { checkAndPurchaseDomains, loadDomains };
