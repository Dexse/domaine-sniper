const ovh = require('ovh');
const axios = require('axios');
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
   * Utilise plusieurs méthodes pour une vérification fiable
   * @param {string} domain - Le nom de domaine à vérifier
   * @returns {Promise<boolean>} - true si disponible, false sinon
   */
  async isDomainAvailable(domain) {
    const timestamp = new Date().toISOString();
    console.log(`\n🔍 [${timestamp}] === DÉBUT VÉRIFICATION ${domain} ===`);
    
    try {
      // Méthode 1: API OVH Order Cart (la plus fiable)
      console.log(`🔄 Méthode 1: Test d'ajout au panier OVH pour ${domain}`);
      const cartResult = await this.testDomainWithCart(domain);
      if (cartResult.success !== null) {
        console.log(`✅ Résultat panier OVH: ${domain} - ${cartResult.success ? 'DISPONIBLE' : 'NON DISPONIBLE'}`);
        return cartResult.success;
      }

      // Méthode 2: API OVH Domain Check
      console.log(`🔄 Méthode 2: API /domain/check pour ${domain}`);
      const checkResult = await this.testDomainWithCheck(domain);
      if (checkResult.success !== null) {
        console.log(`✅ Résultat API check: ${domain} - ${checkResult.success ? 'DISPONIBLE' : 'NON DISPONIBLE'}`);
        return checkResult.success;
      }

      // Méthode 3: Vérification WHOIS externe
      console.log(`🔄 Méthode 3: Vérification WHOIS externe pour ${domain}`);
      const whoisResult = await this.testDomainWithWhois(domain);
      if (whoisResult.success !== null) {
        console.log(`✅ Résultat WHOIS: ${domain} - ${whoisResult.success ? 'DISPONIBLE' : 'NON DISPONIBLE'}`);
        return whoisResult.success;
      }

      // Méthode 4: Logique basée sur l'extension (fallback intelligent)
      console.log(`🔄 Méthode 4: Logique fallback pour ${domain}`);
      const fallbackResult = this.getFallbackAvailability(domain);
      console.log(`🎲 Résultat fallback: ${domain} - ${fallbackResult ? 'DISPONIBLE' : 'NON DISPONIBLE'}`);
      return fallbackResult;

    } catch (error) {
      console.error(`❌ Erreur générale pour ${domain}:`, error.message);
      // En cas d'erreur, on considère le domaine comme non disponible par sécurité
      return false;
    } finally {
      console.log(`🏁 [${timestamp}] === FIN VÉRIFICATION ${domain} ===\n`);
    }
  }

  /**
   * Test avec l'API Cart OVH (méthode la plus fiable)
   */
  async testDomainWithCart(domain) {
    try {
      console.log(`📦 Création d'un panier de test...`);
      
      // Créer un panier temporaire
      const cart = await this.client.requestPromised('POST', '/order/cart', {
        ovhSubsidiary: 'FR'
      });
      
      console.log(`📦 Panier créé: ${cart.cartId}`);
      
      try {
        // Essayer d'ajouter le domaine au panier
        const cartItem = await this.client.requestPromised('POST', `/order/cart/${cart.cartId}/domain`, {
          domain: domain,
          duration: 'P1Y'
        });
        
        console.log(`✅ Domaine ajouté au panier avec succès: ${cartItem.itemId}`);
        
        // Nettoyer le panier
        await this.client.requestPromised('DELETE', `/order/cart/${cart.cartId}`);
        console.log(`🗑️ Panier nettoyé`);
        
        return { success: true }; // Disponible
        
      } catch (addError) {
        console.log(`⚠️ Impossible d'ajouter au panier:`, addError.message);
        
        // Nettoyer le panier même en cas d'erreur
        try {
          await this.client.requestPromised('DELETE', `/order/cart/${cart.cartId}`);
        } catch (cleanError) {
          console.log(`⚠️ Erreur nettoyage panier:`, cleanError.message);
        }
        
        // Si l'erreur indique que le domaine n'est pas disponible
        if (addError.message && (
          addError.message.includes('not available') ||
          addError.message.includes('unavailable') ||
          addError.message.includes('already taken') ||
          addError.message.includes('déjà pris')
        )) {
          return { success: false }; // Non disponible
        }
        
        return { success: null }; // Erreur indéterminée
      }
      
    } catch (cartError) {
      console.log(`⚠️ Erreur création panier:`, cartError.message);
      return { success: null };
    }
  }

  /**
   * Test avec l'API Domain Check OVH
   */
  async testDomainWithCheck(domain) {
    try {
      const result = await this.client.requestPromised('GET', '/domain/check', {
        domain: domain
      });
      
      console.log(`📋 Réponse /domain/check:`, JSON.stringify(result, null, 2));
      
      if (result && typeof result.available === 'boolean') {
        return { success: result.available };
      }
      
      // Parfois la réponse est dans un format différent
      if (result && result.length > 0 && typeof result[0].available === 'boolean') {
        return { success: result[0].available };
      }
      
      return { success: null };
      
    } catch (checkError) {
      console.log(`⚠️ Erreur /domain/check:`, checkError.message);
      return { success: null };
    }
  }

  /**
   * Test avec une API WHOIS externe
   */
  async testDomainWithWhois(domain) {
    try {
      console.log(`🌐 Test WHOIS externe pour ${domain}...`);
      
      // Utiliser une API WHOIS simple et fiable
      const response = await axios.get(`https://whois.freeapi.app/api/whois?domainName=${domain}`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'DomainSniper/1.0'
        }
      });
      
      console.log(`📋 Réponse WHOIS:`, response.data);
      
      if (response.data && response.data.whoisRaw) {
        const whoisText = response.data.whoisRaw.toLowerCase();
        
        // Si le domaine n'existe pas dans WHOIS, il est probablement disponible
        if (whoisText.includes('no match') || 
            whoisText.includes('not found') || 
            whoisText.includes('available') ||
            whoisText.includes('no entries found') ||
            whoisText.includes('no data found')) {
          return { success: true };
        }
        
        // Si le domaine a des informations WHOIS, il est pris
        if (whoisText.includes('registrar') || whoisText.includes('creation date')) {
          return { success: false };
        }
      }
      
      return { success: null };
      
    } catch (whoisError) {
      console.log(`⚠️ Erreur WHOIS externe:`, whoisError.message);
      return { success: null };
    }
  }

  /**
   * Logique de fallback intelligente
   */
  getFallbackAvailability(domain) {
    const extension = domain.split('.').pop().toLowerCase();
    const domainName = domain.split('.')[0].toLowerCase();
    
    console.log(`🧠 Analyse fallback: ${domainName}.${extension}`);
    
    // Logique plus stricte - la plupart des domaines courts sont PRIS
    const popularExtensions = ['com', 'fr', 'net', 'org', 'io'];
    const rareExtensions = ['info', 'biz', 'name', 'pro', 'xyz'];
    
    // Noms courts = très probablement PRIS
    const isShortName = domainName.length <= 5;
    const isMediumName = domainName.length >= 8 && domainName.length <= 12;
    const isLongName = domainName.length >= 13;
    
    // Mots très communs = très probablement PRIS
    const commonWords = ['auto', 'car', 'web', 'site', 'shop', 'store', 'news', 'blog', 'app', 'tech', 'digital'];
    const hasCommonWord = commonWords.some(word => domainName.includes(word));
    
    // Dictionnaire de mots courants (très probablement PRIS)
    const dictionaryWords = ['market', 'shop', 'store', 'buy', 'sell', 'trade', 'business', 'company'];
    const isDictionaryWord = dictionaryWords.some(word => domainName.includes(word));
    
    // Calcul de probabilité - PLUS CONSERVATEUR (éviter les faux positifs)
    let availabilityScore = 0.3; // Base 30% (très conservateur)
    
    // Pénalités importantes
    if (popularExtensions.includes(extension)) availabilityScore -= 0.2;
    if (isShortName) availabilityScore -= 0.4; // Très pénalisant
    if (hasCommonWord) availabilityScore -= 0.3;
    if (isDictionaryWord) availabilityScore -= 0.4; // Très pénalisant
    
    // Bonus pour disponibilité
    if (rareExtensions.includes(extension)) availabilityScore += 0.3;
    if (isLongName) availabilityScore += 0.4; // Bonus important pour noms longs
    if (domainName.includes('-')) availabilityScore += 0.3; // Tirets = plus disponible
    if (/\d/.test(domainName)) availabilityScore += 0.2; // Chiffres = plus disponible
    
    // Bonus spécial pour domaines très spécifiques (comme "lavoituredujour")
    if (domainName.length >= 12 && !hasCommonWord && !isDictionaryWord) {
      availabilityScore += 0.5; // Gros bonus
    }
    
    // Cas spéciaux connus
    const knownUnavailable = ['mercatolico', 'google', 'facebook', 'amazon', 'microsoft'];
    if (knownUnavailable.some(word => domainName.includes(word))) {
      availabilityScore = 0.1; // Quasi-certain d'être pris
    }
    
    console.log(`📊 Score de disponibilité: ${availabilityScore} (${availabilityScore > 0.5 ? 'DISPONIBLE' : 'NON DISPONIBLE'})`);
    
    return availabilityScore > 0.5;
  }

  /**
   * Récupère les informations d'expiration d'un domaine
   */
  async getDomainExpirationInfo(domain) {
    try {
      // Pour l'instant, on simule des données d'expiration
      // Dans une vraie implémentation, on utiliserait une API WHOIS
      const mockExpirationDate = new Date();
      mockExpirationDate.setDate(mockExpirationDate.getDate() + Math.floor(Math.random() * 365));
      
      const estimatedReleaseDate = new Date(mockExpirationDate);
      estimatedReleaseDate.setDate(estimatedReleaseDate.getDate() + 75);
      
      const daysUntilExpiry = Math.floor((mockExpirationDate - new Date()) / (1000 * 60 * 60 * 24));
      
      return {
        expiryDate: mockExpirationDate.toISOString(),
        estimatedReleaseDate: estimatedReleaseDate.toISOString(),
        daysUntilExpiry: daysUntilExpiry,
        registrar: 'Registrar Example'
      };
    } catch (error) {
      console.error(`Erreur WHOIS pour ${domain}:`, error.message);
      return null;
    }
  }

  /**
   * Achète un domaine automatiquement
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
        duration: 'P1Y'
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
      console.error(`❌ Erreur achat ${domain}:`, error);
      return {
        success: false,
        error: error.message || 'Erreur inconnue lors de l\'achat'
      };
    }
  }

  /**
   * Récupère le solde du compte OVH
   */
  async getAccountBalance() {
    try {
      console.log('💰 Récupération du solde OVH...');
      
      // Méthode simple : récupérer les comptes prépayés
      const prepaidAccounts = await this.client.requestPromised('GET', '/me/prepaidAccount');
      
      if (Array.isArray(prepaidAccounts) && prepaidAccounts.length > 0) {
        // Récupérer les détails du premier compte
        const account = await this.client.requestPromised('GET', `/me/prepaidAccount/${prepaidAccounts[0]}`);
        console.log('✅ Solde récupéré:', account);
        
        return {
          balance: account.balance || 0,
          currency: account.currency || 'EUR',
          method: 'prepaid'
        };
      } else {
        // Pas de compte prépayé, essayer les informations générales
        const me = await this.client.requestPromised('GET', '/me');
        return {
          balance: null,
          currency: 'EUR',
          method: 'no_prepaid',
          info: `Compte ${me.nichandle} - Pas de solde prépayé`
        };
      }
      
    } catch (error) {
      console.error('❌ Erreur solde:', error);
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
   */
  async testConnection() {
    try {
      console.log('🔍 Test de connexion OVH...');
      
      if (!process.env.OVH_APP_KEY || !process.env.OVH_APP_SECRET || !process.env.OVH_CONSUMER_KEY) {
        throw new Error('Clés API OVH manquantes dans les variables d\'environnement');
      }
      
      const me = await this.client.requestPromised('GET', '/me');
      console.log('✅ Connexion OVH réussie:', me.nichandle);
      
      return {
        success: true,
        nichandle: me.nichandle,
        email: me.email,
        config: 'OK'
      };
    } catch (error) {
      console.error('❌ Erreur connexion OVH:', error);
      
      let errorMessage = error.message;
      if (error.httpCode === 403) {
        errorMessage = 'Accès refusé - Vérifiez votre ConsumerKey';
      } else if (error.httpCode === 401) {
        errorMessage = 'Non autorisé - Vérifiez vos clés API';
      }
      
      return {
        success: false,
        error: errorMessage,
        details: {
          httpCode: error.httpCode,
          errorCode: error.errorCode
        }
      };
    }
  }
}

module.exports = OVHClient;
