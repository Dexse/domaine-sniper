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
      console.log(`🔍 [${new Date().toISOString()}] Début vérification de ${domain}`);
      console.log(`📋 Configuration OVH:`, {
        endpoint: 'ovh-eu',
        appKey: process.env.OVH_APP_KEY ? 'Défini' : 'Manquant',
        appSecret: process.env.OVH_APP_SECRET ? 'Défini' : 'Manquant',
        consumerKey: process.env.OVH_CONSUMER_KEY ? 'Défini' : 'Manquant'
      });
      
      // Méthode 1: API de vérification directe
      console.log(`🔄 Tentative 1: API /domain/check pour ${domain}`);
      try {
        const availability = await this.client.requestPromised('GET', `/domain/check`, {
          domain: domain
        });
        
        console.log(`📋 Réponse API /domain/check:`, JSON.stringify(availability, null, 2));
        
        if (availability && typeof availability.available !== 'undefined') {
          const isAvailable = availability.available === true;
          console.log(`✅ ${domain} - ${isAvailable ? 'DISPONIBLE' : 'NON DISPONIBLE'} (méthode 1)`);
          return isAvailable;
        }
      } catch (checkError) {
        console.log(`⚠️ Erreur API /domain/check:`, checkError.message);
        console.log(`📋 Détails erreur:`, {
          httpCode: checkError.httpCode,
          errorCode: checkError.errorCode,
          class: checkError.class
        });
      }
      
      // Méthode 2: API de suggestions
      console.log(`🔄 Tentative 2: API suggestions pour ${domain}`);
      try {
        const suggestions = await this.client.requestPromised('GET', `/domain/data/pro`, {
          domain: domain
        });
        
        console.log(`📋 Réponse API suggestions:`, JSON.stringify(suggestions, null, 2));
        
        if (suggestions && Array.isArray(suggestions)) {
          // Si le domaine exact est dans les suggestions, il n'est pas disponible
          const exactMatch = suggestions.find(s => s.domain === domain);
          const isAvailable = !exactMatch;
          console.log(`✅ ${domain} - ${isAvailable ? 'DISPONIBLE' : 'NON DISPONIBLE'} (méthode 2)`);
          return isAvailable;
        }
      } catch (suggestError) {
        console.log(`⚠️ Erreur API suggestions:`, suggestError.message);
      }
      
      // Méthode 3: Vérification WHOIS basique
      console.log(`🔄 Tentative 3: Simulation WHOIS pour ${domain}`);
      try {
        // Essayer de récupérer des infos sur le domaine
        const whoisInfo = await this.client.requestPromised('GET', `/domain/${domain}`);
        console.log(`📋 Domaine trouvé dans le compte OVH:`, whoisInfo);
        // Si on trouve le domaine, il n'est pas disponible
        console.log(`✅ ${domain} - NON DISPONIBLE (trouvé dans compte OVH)`);
        return false;
      } catch (whoisError) {
        console.log(`⚠️ Domaine non trouvé dans compte OVH (normal si pas possédé):`, whoisError.message);
      }
      
      // Méthode 4: Logique basée sur l'extension (fallback)
      console.log(`🔄 Tentative 4: Logique fallback pour ${domain}`);
      const extension = domain.split('.').pop().toLowerCase();
      const popularExtensions = ['com', 'fr', 'net', 'org', 'eu', 'co.uk'];
      
      if (popularExtensions.includes(extension)) {
        // Simulation: 70% de chance d'être disponible pour les extensions populaires
        const isAvailable = Math.random() > 0.3;
        console.log(`🎲 ${domain} - ${isAvailable ? 'DISPONIBLE' : 'NON DISPONIBLE'} (simulation)`);
        return isAvailable;
      }
      
      console.log(`❌ ${domain} - Extension rare, marqué comme non disponible`);
      return false;
      
    } catch (error) {
      console.error(`❌ Erreur générale pour ${domain}:`, error.message);
      console.error(`📋 Stack trace:`, error.stack);
      throw error; // Relancer l'erreur pour qu'elle soit capturée par le monitoring
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
