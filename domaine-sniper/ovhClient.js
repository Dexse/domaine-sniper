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
   * Vérifier si un domaine est disponible
   */
  async isDomainAvailable(domain) {
    console.log(`🔍 Vérification de disponibilité pour: ${domain}`);
    
    try {
      // Test direct avec OVH : essayer d'acheter le domaine
      console.log(`📦 Test d'achat OVH pour ${domain}...`);
      
      const cart = await this.client.requestPromised('POST', '/order/cart', {
        ovhSubsidiary: 'FR'
      });
      
      console.log(`✅ Panier créé: ${cart.cartId}`);
      
      try {
        // Essayer d'ajouter le domaine
        const cartItem = await this.client.requestPromised('POST', `/order/cart/${cart.cartId}/domain`, {
          domain: domain,
          duration: 'P1Y'
        });
        
        console.log(`✅ Domaine ${domain} ajouté au panier avec succès`);
        
        // Essayer d'assigner le panier pour voir si c'est vraiment disponible
        try {
          await this.client.requestPromised('POST', `/order/cart/${cart.cartId}/assign`);
          console.log(`✅ Panier assigné - ${domain} est DISPONIBLE`);
          
          // Nettoyer le panier de test
          try {
            await this.client.requestPromised('DELETE', `/order/cart/${cart.cartId}`);
          } catch (e) {}
          
          return true; // Domaine disponible
          
        } catch (assignError) {
          console.log(`❌ Impossible d'assigner le panier - ${domain} NON DISPONIBLE`);
          
          // Nettoyer le panier
          try {
            await this.client.requestPromised('DELETE', `/order/cart/${cart.cartId}`);
          } catch (e) {}
          
          return false; // Domaine non disponible
        }
        
      } catch (addError) {
        console.log(`❌ Impossible d'ajouter ${domain} au panier - NON DISPONIBLE`);
        
        // Nettoyer le panier
        try {
          await this.client.requestPromised('DELETE', `/order/cart/${cart.cartId}`);
        } catch (e) {}
        
        return false; // Domaine non disponible
      }
      
    } catch (error) {
      console.log(`❌ Erreur générale pour ${domain}: ${error.message}`);
      return false;
    }
  }

  /**
   * Acheter un domaine
   */
  async purchaseDomain(domain) {
    console.log(`🛒 DÉBUT ACHAT AUTOMATIQUE pour ${domain}`);
    
    try {
      // 1. Vérifier que le domaine est toujours disponible
      console.log(`🔍 Vérification finale de disponibilité...`);
      const stillAvailable = await this.isDomainAvailable(domain);
      
      if (!stillAvailable) {
        console.log(`❌ Domaine ${domain} n'est plus disponible`);
        return {
          success: false,
          error: 'Domaine plus disponible au moment de l\'achat'
        };
      }
      
      console.log(`✅ Domaine ${domain} confirmé disponible`);
      
      // 2. Créer un panier
      console.log(`📦 Création du panier d'achat...`);
      const cart = await this.client.requestPromised('POST', '/order/cart', {
        ovhSubsidiary: 'FR'
      });
      
      console.log(`✅ Panier créé: ${cart.cartId}`);
      
      // 3. Ajouter le domaine au panier
      console.log(`➕ Ajout du domaine au panier...`);
      const cartItem = await this.client.requestPromised('POST', `/order/cart/${cart.cartId}/domain`, {
        domain: domain,
        duration: 'P1Y'
      });
      
      console.log(`✅ Domaine ajouté au panier: ${cartItem.itemId}`);
      
      // 4. Assigner le panier
      console.log(`🔗 Assignation du panier...`);
      try {
        await this.client.requestPromised('POST', `/order/cart/${cart.cartId}/assign`);
        console.log(`✅ Panier assigné`);
      } catch (assignError) {
        console.log(`⚠️ Erreur assignation (continuons): ${assignError.message}`);
      }
      
      // 5. Attendre un peu
      console.log(`⏳ Attente de stabilisation...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 6. Valider la commande
      console.log(`💳 Validation de la commande...`);
      const order = await this.client.requestPromised('POST', `/order/cart/${cart.cartId}/checkout`);
      
      console.log(`🎉 ACHAT RÉUSSI !`);
      console.log(`📋 ID Commande: ${order.orderId}`);
      
      return {
        success: true,
        orderId: order.orderId,
        price: order.prices ? order.prices.withTax.value : null,
        priceText: order.prices ? order.prices.withTax.text : null
      };
      
    } catch (error) {
      console.log(`❌ ERREUR ACHAT ${domain}: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        details: {
          httpCode: error.httpCode,
          class: error.class
        }
      };
    }
  }

  /**
   * Obtenir des informations sur l'expiration d'un domaine
   */
  async getDomainExpirationInfo(domain) {
    try {
      // Cette méthode est optionnelle et peut échouer
      // On retourne null si pas d'info disponible
      return null;
    } catch (error) {
      return null;
    }
  }
}

module.exports = OVHClient;
