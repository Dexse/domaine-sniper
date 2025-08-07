const ovh = require('ovh');

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
   * Test de connexion OVH
   */
  async testConnection() {
    try {
      const me = await this.client.requestPromised('GET', '/me');
      return {
        success: true,
        nichandle: me.nichandle,
        message: 'Connexion OVH réussie'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Récupérer le solde du compte
   */
  async getAccountBalance() {
    try {
      const accounts = await this.client.requestPromised('GET', '/me/prepaidAccount');
      if (accounts && accounts.length > 0) {
        const account = await this.client.requestPromised('GET', `/me/prepaidAccount/${accounts[0]}`);
        return {
          balance: parseFloat(account.balance),
          currency: account.currency
        };
      }
      return { balance: 0, currency: 'EUR' };
    } catch (error) {
      return { balance: null, error: error.message };
    }
  }

  /**
   * VÉRIFIER SI UN DOMAINE EST DISPONIBLE À L'ACHAT
   * Méthode simple et fiable : essayer de créer une commande
   */
  async isDomainAvailable(domain) {
    console.log(`🔍 [${domain}] Vérification de disponibilité...`);
    
    let cartId = null;
    
    try {
      // 1. Créer un panier de test
      console.log(`📦 [${domain}] Création du panier de test...`);
      const cart = await this.client.requestPromised('POST', '/order/cart', {
        ovhSubsidiary: 'FR'
      });
      cartId = cart.cartId;
      console.log(`✅ [${domain}] Panier créé: ${cartId}`);
      
      // 2. Essayer d'ajouter le domaine
      console.log(`➕ [${domain}] Test d'ajout au panier...`);
      await this.client.requestPromised('POST', `/order/cart/${cartId}/domain`, {
        domain: domain,
        duration: 'P1Y'
      });
      console.log(`✅ [${domain}] Domaine ajouté au panier`);
      
      // 3. Essayer d'assigner le panier (étape critique)
      console.log(`🔗 [${domain}] Test d'assignation du panier...`);
      await this.client.requestPromised('POST', `/order/cart/${cartId}/assign`);
      console.log(`✅ [${domain}] Panier assigné avec succès`);
      
      // 4. Vérifier que le panier peut être validé
      console.log(`🔍 [${domain}] Vérification finale...`);
      const summary = await this.client.requestPromised('GET', `/order/cart/${cartId}/summary`);
      
      if (summary && summary.totals && summary.totals.withTax && summary.totals.withTax.value > 0) {
        console.log(`🎯 [${domain}] DOMAINE DISPONIBLE ! Prix: ${summary.totals.withTax.text}`);
        
        // Nettoyer le panier de test
        try {
          await this.client.requestPromised('DELETE', `/order/cart/${cartId}`);
          console.log(`🧹 [${domain}] Panier de test supprimé`);
        } catch (e) {
          console.log(`⚠️ [${domain}] Erreur nettoyage panier: ${e.message}`);
        }
        
        return true; // DISPONIBLE
      } else {
        console.log(`❌ [${domain}] Panier invalide - NON DISPONIBLE`);
        return false;
      }
      
    } catch (error) {
      console.log(`❌ [${domain}] Erreur: ${error.message}`);
      
      // Nettoyer le panier en cas d'erreur
      if (cartId) {
        try {
          await this.client.requestPromised('DELETE', `/order/cart/${cartId}`);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      
      return false; // NON DISPONIBLE
    }
  }

  /**
   * ACHETER UN DOMAINE AUTOMATIQUEMENT
   */
  async purchaseDomain(domain) {
    console.log(`🛒 [${domain}] DÉBUT ACHAT AUTOMATIQUE`);
    
    let cartId = null;
    
    try {
      // 1. Vérification finale de disponibilité
      console.log(`🔍 [${domain}] Vérification finale avant achat...`);
      const stillAvailable = await this.isDomainAvailable(domain);
      
      if (!stillAvailable) {
        console.log(`❌ [${domain}] Plus disponible au moment de l'achat`);
        return {
          success: false,
          error: 'Domaine plus disponible'
        };
      }
      
      // 2. Créer le panier d'achat
      console.log(`📦 [${domain}] Création du panier d'achat...`);
      const cart = await this.client.requestPromised('POST', '/order/cart', {
        ovhSubsidiary: 'FR'
      });
      cartId = cart.cartId;
      console.log(`✅ [${domain}] Panier d'achat créé: ${cartId}`);
      
      // 3. Ajouter le domaine
      console.log(`➕ [${domain}] Ajout du domaine au panier...`);
      await this.client.requestPromised('POST', `/order/cart/${cartId}/domain`, {
        domain: domain,
        duration: 'P1Y'
      });
      console.log(`✅ [${domain}] Domaine ajouté au panier d'achat`);
      
      // 4. Assigner le panier
      console.log(`🔗 [${domain}] Assignation du panier...`);
      await this.client.requestPromised('POST', `/order/cart/${cartId}/assign`);
      console.log(`✅ [${domain}] Panier assigné`);
      
      // 5. Finaliser la commande
      console.log(`💳 [${domain}] Finalisation de la commande...`);
      const order = await this.client.requestPromised('POST', `/order/cart/${cartId}/checkout`);
      
      console.log(`🎉 [${domain}] ACHAT RÉUSSI !`);
      console.log(`📋 [${domain}] ID Commande: ${order.orderId}`);
      
      return {
        success: true,
        orderId: order.orderId,
        price: order.prices ? order.prices.withTax.value : null,
        priceText: order.prices ? order.prices.withTax.text : null
      };
      
    } catch (error) {
      console.log(`❌ [${domain}] ERREUR ACHAT: ${error.message}`);
      
      // Nettoyer le panier en cas d'erreur
      if (cartId) {
        try {
          await this.client.requestPromised('DELETE', `/order/cart/${cartId}`);
          console.log(`🧹 [${domain}] Panier d'achat supprimé après erreur`);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtenir des informations sur l'expiration d'un domaine (optionnel)
   */
  async getDomainExpirationInfo(domain) {
    // Cette méthode est optionnelle et peut échouer
    return null;
  }
}

module.exports = OVHClient;
