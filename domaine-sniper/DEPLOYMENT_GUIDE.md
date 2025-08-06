# 🚀 Guide de déploiement Railway - Domaine Sniper

## Étape 1 : Créer un compte GitHub (si vous n'en avez pas)

1. Allez sur [github.com](https://github.com)
2. Cliquez sur "Sign up"
3. Créez votre compte avec email/mot de passe
4. Vérifiez votre email

## Étape 2 : Mettre le code sur GitHub

### Option A : Via l'interface web GitHub (plus simple)
1. Connectez-vous sur GitHub
2. Cliquez sur le bouton vert "New" ou "+"
3. Nommez votre repository : `domaine-sniper`
4. Cochez "Add a README file"
5. Cliquez "Create repository"
6. Cliquez sur "uploading an existing file"
7. Glissez-déposez TOUS les fichiers de votre projet
8. Écrivez un message : "Initial commit"
9. Cliquez "Commit changes"

### Option B : Via Git (si vous connaissez)
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/VOTRE-USERNAME/domaine-sniper.git
git push -u origin main
```

## Étape 3 : Créer un compte Railway

1. Allez sur [railway.app](https://railway.app)
2. Cliquez "Login" puis "Login with GitHub"
3. Autorisez Railway à accéder à GitHub
4. Vous êtes connecté !

## Étape 4 : Déployer votre projet

1. Sur Railway, cliquez "New Project"
2. Sélectionnez "Deploy from GitHub repo"
3. Choisissez votre repository `domaine-sniper`
4. Railway va automatiquement détecter que c'est du Node.js
5. Cliquez "Deploy"

## Étape 5 : Configurer les variables d'environnement

⚠️ **IMPORTANT** : Vos clés OVH doivent être configurées !

1. Dans Railway, cliquez sur votre projet
2. Allez dans l'onglet "Variables"
3. Ajoutez ces variables une par une :

```
OVH_APP_KEY=votre_app_key_ovh
OVH_APP_SECRET=votre_app_secret_ovh  
OVH_CONSUMER_KEY=votre_consumer_key_ovh
CHECK_INTERVAL=60000
NODE_ENV=production
```

4. Cliquez "Add" pour chaque variable
5. Railway va redéployer automatiquement

## Étape 6 : Obtenir l'URL de votre application

1. Dans Railway, cliquez sur votre projet
2. Allez dans l'onglet "Settings"
3. Cliquez "Generate Domain"
4. Votre URL sera quelque chose comme : `https://domaine-sniper-production.up.railway.app`

## Étape 7 : Tester votre application

1. Ouvrez l'URL dans votre navigateur
2. Vous devriez voir votre dashboard !
3. Testez la connexion OVH dans l'interface

## 🔧 Dépannage

### Si le déploiement échoue :
1. Vérifiez les logs dans Railway (onglet "Deployments")
2. Assurez-vous que tous les fichiers sont sur GitHub
3. Vérifiez que vos variables d'environnement sont correctes

### Si l'application ne démarre pas :
1. Vérifiez les variables OVH dans Railway
2. Regardez les logs pour voir l'erreur exacte
3. Le port doit être automatiquement détecté par Railway

### Si vous avez des erreurs OVH :
1. Vérifiez que vos clés OVH sont correctes
2. Assurez-vous que votre ConsumerKey est validé
3. Testez d'abord en local avant de déployer

## 💰 Coûts Railway

- **Gratuit** : 500 heures par mois (largement suffisant)
- **Payant** : $5/mois si vous dépassez

## 🆘 Besoin d'aide ?

Si vous êtes bloqué à une étape, notez :
1. À quelle étape vous êtes bloqué
2. Le message d'erreur exact (si il y en a un)
3. Une capture d'écran si possible

## 🎉 Félicitations !

Une fois déployé, votre outil de surveillance de domaines sera accessible 24/7 sur internet !
