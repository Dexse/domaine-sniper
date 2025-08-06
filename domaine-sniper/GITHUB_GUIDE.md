# 📚 Guide GitHub étape par étape (débutant)

## Étape 1 : Créer un compte GitHub

### 1.1 Aller sur GitHub
1. Ouvrez votre navigateur
2. Tapez : `github.com`
3. Appuyez sur Entrée

### 1.2 Créer le compte
1. Cliquez sur le bouton vert **"Sign up"** (en haut à droite)
2. Remplissez le formulaire :
   - **Email** : votre adresse email
   - **Password** : un mot de passe sécurisé
   - **Username** : choisissez un nom d'utilisateur (ex: `monnom-dev`)
3. Résolvez le captcha (puzzle)
4. Cliquez **"Create account"**

### 1.3 Vérifier votre email
1. Allez dans votre boîte email
2. Cherchez un email de GitHub
3. Cliquez sur le lien de vérification
4. Revenez sur GitHub

### 1.4 Finaliser le profil (optionnel)
1. GitHub peut vous poser quelques questions
2. Vous pouvez répondre ou cliquer "Skip"
3. Vous arrivez sur votre tableau de bord GitHub

## Étape 2 : Créer un nouveau repository (dépôt)

### 2.1 Créer le repository
1. Sur votre tableau de bord GitHub
2. Cliquez sur le bouton vert **"New"** (ou le "+" en haut à droite)
3. Sélectionnez **"New repository"**

### 2.2 Configurer le repository
1. **Repository name** : tapez `domaine-sniper`
2. **Description** : tapez `Outil de surveillance de domaines expirés`
3. Laissez **"Public"** sélectionné (c'est gratuit)
4. ✅ Cochez **"Add a README file"**
5. Cliquez le bouton vert **"Create repository"**

## Étape 3 : Uploader vos fichiers

### 3.1 Préparer l'upload
1. Vous êtes maintenant dans votre repository
2. Cliquez sur **"uploading an existing file"** (lien bleu)

### 3.2 Sélectionner les fichiers
**IMPORTANT** : Vous devez uploader TOUS ces fichiers :

```
✅ Fichiers à uploader :
- index.js
- server.js  
- database.js
- ovhClient.js
- getConsumerKey.js
- domains.json
- package.json
- railway.toml
- DEPLOYMENT_GUIDE.md
- GITHUB_GUIDE.md
- README.md
- .gitignore

❌ Fichiers à NE PAS uploader :
- .env (contient vos clés secrètes)
- domaine_sniper.db (base de données locale)
- node_modules/ (dossier des dépendances)
- package-lock.json (fichier technique)
```

### 3.3 Uploader les fichiers
1. **Glissez-déposez** tous les fichiers dans la zone
   OU
2. Cliquez **"choose your files"** et sélectionnez-les

### 3.4 Confirmer l'upload
1. En bas de la page, dans **"Commit changes"**
2. Tapez : `Ajout initial du projet Domaine Sniper`
3. Cliquez le bouton vert **"Commit changes"**

## Étape 4 : Vérifier que tout est bon

### 4.1 Vérifier les fichiers
1. Vous devriez voir tous vos fichiers listés
2. Cliquez sur quelques fichiers pour vérifier le contenu
3. Assurez-vous que `package.json` et `server.js` sont présents

### 4.2 Noter l'URL de votre repository
Votre URL ressemble à :
```
https://github.com/VOTRE-USERNAME/domaine-sniper
```

## 🎉 Félicitations !

Votre code est maintenant sur GitHub !

## ➡️ Prochaine étape

Dites-moi : **"GitHub terminé"** et je vous guiderai pour Railway !

## 🆘 Problèmes courants

### "Je ne trouve pas le bouton New"
- Regardez en haut à droite, il y a un "+"
- Cliquez dessus puis "New repository"

### "Je n'arrive pas à uploader"
- Vérifiez que vous êtes dans votre repository
- Essayez de rafraîchir la page
- Utilisez Chrome ou Firefox

### "Quel nom d'utilisateur choisir ?"
- Utilisez votre nom ou pseudo
- Évitez les espaces et caractères spéciaux
- Ex: `jean-dupont`, `marie-dev`, `alex2024`

### "Je ne reçois pas l'email de vérification"
- Vérifiez vos spams
- Attendez 5-10 minutes
- Vous pouvez continuer sans vérifier pour l'instant
