const ovh = require('ovh');
require('dotenv').config();

class OVHClient {
  constructor() {
    this.client = ovh({
      endpoint: 'ovh-eu',
      appKey: process.env.OVH_APP_KEY,
      appSecret: process.env.OVH_APP_SECRET,
      consumerKey: process.env.OVH_CONSUMER_KEY
    });
  }

  /**
   * Vérifie si un domaine est disponible à l'achat
   * @param {string} domain - Le nom de domaine à vérifier
   * @returns {Promise<boolean>} - true si disponible, false sinon
   */
  async isDomainAvailable(domain) {
    try {
      console.log(`🔍 Vérification de la disponibilité de ${domain}...`);

      // Utiliser l'API de vérification de disponibilité OVH
      const result = await this.client.requestPromised('GET', `/domain/zone/${domain}/status`);

      // Si on arrive ici sans erreur, le domaine existe encore
      return false;

    } catch (error) {
      // Si erreur 404, le domaine n'existe pas = disponible
      if (error.error === 404 || error.message.includes('404')) {
        console.log(`✅ ${domain} semble disponible (404)`);
        return true;
      }

      // Pour les autres erreurs, on considère comme non disponible par sécurité
      console.log(`⚠️ Erreur lors de la vérification de ${domain}:`, error.message);
      return false;
    }
  }

  /**
   * Récupère les informations d'expiration d'un domaine via WHOIS
   * @param {string} domain - Le nom de domaine
   * @returns {Promise<Object|null>} - Informations d'expiration ou null
   */
  async getDomainExpirationInfo(domain) {
    try {
      // Simulation d'informations WHOIS (à remplacer par une vraie API WHOIS)
      const mockExpirationDate = new Date();
      mockExpirationDate.setDate(mockExpirationDate.getDate() + Math.floor(Math.random() * 365));

      const estimatedReleaseDate = new Date(mockExpirationDate);
      estimatedReleaseDate.setDate(estimatedReleaseDate.getDate() + 75); // +75 jours après expiration

      const daysUntilExpiry = Math.floor((mockExpirationDate - new Date()) / (1000 * 60 * 60 * 24));

      return {
        expiryDate: mockExpirationDate.toISOString(),
        estimatedReleaseDate: estimatedReleaseDate.toISOString(),
        daysUntilExpiry: daysUntilExpiry,
        registrar: 'Registrar Example'
      };
    } catch (error) {
      console.error(`Erreur lors de la récupération des infos WHOIS pour ${domain}:`, error.message);
      return null;
    }
  }

  /**
   * Achète un domaine automatiquement
   * @param {string} domain - Le nom de domaine à acheter
   * @returns {Promise<Object>} - Résultat de l'achat
   */
  async purchaseDomain(domain) {
    try {
      console.log(`🛒 Tentative d'achat automatique pour ${domain}...`);

      // 1. Créer un panier
      const cart = await this.client.requestPromised('POST', '/order/cart', {
        ovhSubsidiary: 'FR'
      });

      console.log(`📦 Panier créé: ${cart.cartId}`);

      // 2. Ajouter le domaine au panier
      const cartItem = await this.client.requestPromised('POST', `/order/cart/${cart.cartId}/domain`, {
        domain: domain,
        duration: 'P1Y' // 1 an
      });

      console.log(`➕ Domaine ajouté au panier: ${cartItem.itemId}`);

      // 3. Valider le panier
      const order = await this.client.requestPromised('POST', `/order/cart/${cart.cartId}/checkout`);

      console.log(`✅ Commande créée: ${order.orderId}`);

      return {
        success: true,
        orderId: order.orderId,
        cartId: cart.cartId
      };

    } catch (error) {
      console.error(`❌ Erreur lors de l'achat de ${domain}:`, error);
      return {
        success: false,
        error: error.message || 'Erreur inconnue lors de l\'achat'
      };
    }
  }

  /**
   * Récupère le solde du compte OVH
   * @returns {Promise<Object>} - Informations sur le solde
   */
  async getAccountBalance() {
    try {
      console.log('💰 Récupération du solde OVH...');

      // Méthode 1: Essayer l'API du compte prépayé (plus fiable)
      try {
        const prepaidAccounts = await this.client.requestPromised('GET', '/me/prepaidAccount');
        console.log('✅ Comptes prépayés récupérés:', prepaidAccounts);

        if (prepaidAccounts && prepaidAccounts.length > 0) {
          // Prendre le premier compte prépayé (généralement le principal)
          const accountId = prepaidAccounts[0];
          const accountDetails = await this.client.requestPromised('GET', `/me/prepaidAccount/${accountId}`);
          console.log('✅ Détails du compte prépayé:', accountDetails);

          return {
            balance: parseFloat(accountDetails.balance || 0),
            currency: accountDetails.currency || 'EUR',
            method: 'prepaid_account'
          };
        }
      } catch (prepaidError) {
        console.log('⚠️ Erreur avec /me/prepaidAccount:', prepaidError.message);
      }

      // Méthode 2: Essayer l'API de facturation
      try {
        const balance = await this.client.requestPromised('GET', '/me/bill/balance');
        console.log('✅ Solde récupéré via /me/bill/balance:', balance);
        return {
          balance: parseFloat(balance.balance || 0),
          currency: balance.currency || 'EUR',
          method: 'billing'
        };
      } catch (billingError) {
        console.log('⚠️ Erreur avec /me/bill/balance:', billingError.message);
      }

      // Méthode 3: Essayer les moyens de paiement
      try {
        const paymentMethods = await this.client.requestPromised('GET', '/me/payment/method');
        console.log('✅ Moyens de paiement récupérés:', paymentMethods.length);

        // Chercher un compte prépayé
        for (const methodId of paymentMethods) {
          try {
            const method = await this.client.requestPromised('GET', `/me/payment/method/${methodId}`);
            console.log(`Méthode de paiement ${methodId}:`, method);
            if (method.paymentType === 'PREPAID_ACCOUNT' && method.balance !== undefined) {
              console.log('✅ Solde trouvé dans les moyens de paiement:', method);
              return {
                balance: parseFloat(method.balance || 0),
                currency: 'EUR',
                method: 'payment_method'
              };
            }
          } catch (methodError) {
            console.log(`⚠️ Erreur avec le moyen de paiement ${methodId}:`, methodError.message);
          }
        }
      } catch (paymentError) {
        console.log('⚠️ Erreur avec /me/payment/method:', paymentError.message);
      }

      // Méthode 4: Essayer l'API des factures pour estimer le crédit
      try {
        const bills = await this.client.requestPromised('GET', '/me/bill', {
          date: {
            from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 jours
            to: new Date().toISOString()
          }
        });

        console.log(`✅ ${bills.length} factures récupérées pour estimation`);

        // Calculer une estimation basée sur les factures récentes
        let totalPaid = 0;
        let totalUsed = 0;

        for (const billId of bills.slice(0, 10)) { // Limiter à 10 factures
          try {
            const bill = await this.client.requestPromised('GET', `/me/bill/${billId}`);
            if (bill.priceWithTax && bill.priceWithTax.value) {
              if (bill.priceWithTax.value > 0) {
                totalPaid += bill.priceWithTax.value;
              } else {
                totalUsed += Math.abs(bill.priceWithTax.value);
              }
            }
          } catch (billError) {
            console.log(`⚠️ Erreur avec la facture ${billId}:`, billError.message);
          }
        }

        const estimatedBalance = totalPaid - totalUsed;
        console.log(`📊 Estimation du solde: ${estimatedBalance}€ (payé: ${totalPaid}€, utilisé: ${totalUsed}€)`);

        return {
          balance: Math.max(0, estimatedBalance), // Ne pas afficher de solde négatif
          currency: 'EUR',
          method: 'estimated',
          estimated: true
        };

      } catch (billsError) {
        console.log('⚠️ Erreur avec /me/bill:', billsError.message);
      }

      // Si toutes les méthodes échouent
      console.log('❌ Impossible de récupérer le solde par aucune méthode');
      return {
        balance: null,
        currency: 'EUR',
        method: 'failed',
        error: 'Impossible de récupérer le solde. Vérifiez les permissions de votre ConsumerKey.'
      };

    } catch (error) {
      console.error('❌ Erreur générale lors de la récupération du solde:', error);
      return {
        balance: null,
        currency: 'EUR',
        method: 'error',
        error: error.message
      };
    }
  }

  /**
   * Teste la connexion à l'API OVH
   * @returns {Promise<Object>} - Résultat du test
   */
  async testConnection() {
    try {
      console.log('🔍 Test de connexion OVH...');
      console.log('📋 Configuration:', {
        endpoint: 'ovh-eu',
        appKey: process.env.OVH_APP_KEY ? '✅ Défini' : '❌ Manquant',
        appSecret: process.env.OVH_APP_SECRET ? '✅ Défini' : '❌ Manquant',
        consumerKey: process.env.OVH_CONSUMER_KEY ? '✅ Défini' : '❌ Manquant'
      });

      // Vérifier que toutes les clés sont présentes
      if (!process.env.OVH_APP_KEY || !process.env.OVH_APP_SECRET || !process.env.OVH_CONSUMER_KEY) {
        throw new Error('Clés API OVH manquantes dans le fichier .env');
      }

      console.log('🔑 Tentative d\'appel API /me...');
      const me = await this.client.requestPromised('GET', '/me');
      console.log('✅ Connexion OVH réussie pour:', me.nichandle);
      return {
        success: true,
        nichandle: me.nichandle,
        email: me.email,
        config: 'OK'
      };
    } catch (error) {
      console.error('❌ Erreur de connexion OVH détaillée:', {
        message: error.message,
        error: error.error,
        httpCode: error.httpCode,
        errorCode: error.errorCode,
        class: error.class
      });

      // Messages d'erreur plus explicites
      let errorMessage = error.message;
      if (error.httpCode === 403) {
        errorMessage = 'Accès refusé - Vérifiez votre ConsumerKey et ses permissions';
      } else if (error.httpCode === 401) {
        errorMessage = 'Non autorisé - Vérifiez vos clés APP_KEY et APP_SECRET';
      } else if (error.httpCode === 400) {
        errorMessage = 'Requête invalide - ConsumerKey peut-être expiré';
      }

      return {
        success: false,
        error: errorMessage,
        details: {
          httpCode: error.httpCode,
          errorCode: error.errorCode,
          class: error.class
        }
      };
    }
  }
}

module.exports = OVHClient;
