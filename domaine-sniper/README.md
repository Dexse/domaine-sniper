# 🎯 Domaine Sniper

Un outil de surveillance et d'achat automatique de domaines expirés utilisant l'API OVH.

## 🌐 Version en ligne

Cette application est déployée sur Railway et accessible 24/7.

## 🚀 Fonctionnalités

- ✅ Surveillance automatique des domaines expirés
- 🛒 Achat automatique des domaines disponibles
- 🔄 Vérifications périodiques configurables
- 📋 Gestion des domaines via fichier JSON
- 📝 Logs détaillés dans la console

## 📦 Installation

1. **Cloner et installer les dépendances**
```bash
npm install
```

2. **Configurer les variables d'environnement**

Remplissez le fichier `.env` avec vos clés d'API :

```env
# Clés d'API OVH
OVH_APP_KEY=your_ovh_app_key_here
OVH_APP_SECRET=your_ovh_app_secret_here
OVH_CONSUMER_KEY=your_ovh_consumer_key_here

# Configuration générale
CHECK_INTERVAL=60000
```

3. **Générer le ConsumerKey OVH**
```bash
npm run generate-key
```

4. **Configurer les domaines à surveiller**

Modifiez le fichier `domains.json` :
```json
[
  "exemple-domaine1.com",
  "exemple-domaine2.net",
  "domaine-expire.org"
]
```

## 🏃‍♂️ Utilisation

### Démarrer la surveillance
```bash
npm start
```

### Générer un nouveau ConsumerKey
```bash
npm run generate-key
```

## 📋 Configuration OVH

1. Créez une application OVH sur [eu.api.ovh.com/createApp](https://eu.api.ovh.com/createApp)
2. Notez votre `Application Key` et `Application Secret`
3. Utilisez `npm run generate-key` pour obtenir votre `Consumer Key`
4. Validez le lien fourni pour activer les permissions

## 🔧 Structure du projet

```
domaine-sniper/
├── index.js              # Point d'entrée principal
├── ovhClient.js          # Client pour l'API OVH
├── getConsumerKey.js     # Générateur de ConsumerKey
├── domains.json          # Liste des domaines à surveiller
├── .env                  # Variables d'environnement
├── package.json          # Configuration npm
└── README.md            # Documentation
```

## ⚙️ Fonctionnement

1. **Surveillance** : Le script vérifie périodiquement (défaut: 60s) la disponibilité des domaines
2. **Détection** : Quand un domaine devient disponible, un message est affiché dans la console
3. **Achat automatique** : Le domaine est automatiquement acheté via l'API OVH
4. **Nettoyage** : Les domaines achetés sont retirés de la liste de surveillance

## 🛟 Support

- Vérifiez les logs de la console pour le débogage
- Le programme redémarre automatiquement en cas d'erreur

## ⚠️ Important

- Assurez-vous d'avoir suffisamment de crédit sur votre compte OVH
- Les domaines sont achetés automatiquement - surveillez vos dépenses
- Validez votre ConsumerKey dans les 24h après génération
- Testez d'abord avec des domaines moins chers

## 📄 Licence

MIT License


