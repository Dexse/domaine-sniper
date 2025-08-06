const ovh = require('ovh');
require('dotenv').config();

/**
 * Script pour générer un consumerKey OVH avec les bonnes permissions
 */
async function generateConsumerKey() {
  console.log('🔑 Génération du ConsumerKey OVH...\n');

  if (!process.env.OVH_APP_KEY || !process.env.OVH_APP_SECRET) {
    console.error('❌ Erreur: OVH_APP_KEY et OVH_APP_SECRET doivent être définis dans le fichier .env');
    process.exit(1);
  }

  const client = ovh({
    endpoint: 'ovh-eu',
    appKey: process.env.OVH_APP_KEY,
    appSecret: process.env.OVH_APP_SECRET
  });

  try {
    const credentials = await client.requestPromised('POST', '/auth/credential', {
      accessRules: [
        // Permissions pour vérifier les domaines
        { method: 'GET', path: '/domain/*' },
        { method: 'GET', path: '/order/domain/*' },

        // Permissions pour acheter des domaines
        { method: 'POST', path: '/order/cart' },
        { method: 'POST', path: '/order/cart/*' },
        { method: 'GET', path: '/order/cart/*' },
        { method: 'DELETE', path: '/order/cart/*' },

        // Permissions pour consulter les commandes
        { method: 'GET', path: '/me/order/*' },

        // Permissions pour les informations du compte et facturation
        { method: 'GET', path: '/me' },
        { method: 'GET', path: '/me/bill/*' },
        { method: 'GET', path: '/me/prepaidAccount' },
        { method: 'GET', path: '/me/payment/method' },
        { method: 'GET', path: '/me/payment/method/*' }
      ]
    });

    console.log('✅ ConsumerKey généré avec succès!\n');
    console.log('📋 Informations importantes:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔑 ConsumerKey: ${credentials.consumerKey}`);
    console.log(`🔗 Lien de validation: ${credentials.validationUrl}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📝 Instructions:');
    console.log('1. Cliquez sur le lien de validation ci-dessus');
    console.log('2. Connectez-vous à votre compte OVH');
    console.log('3. Autorisez l\'application');
    console.log('4. Copiez le ConsumerKey dans votre fichier .env');
    console.log('5. Relancez le script principal avec: npm start\n');

    console.log('⚠️  IMPORTANT: Ce ConsumerKey expire si vous ne validez pas le lien dans les 24h!');

  } catch (error) {
    console.error('❌ Erreur lors de la génération du ConsumerKey:', error.message);
    console.error('\n💡 Vérifiez que vos clés OVH_APP_KEY et OVH_APP_SECRET sont correctes dans le fichier .env');
    process.exit(1);
  }
}

// Exécution du script
generateConsumerKey();
