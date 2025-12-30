# Guide de Contribution

Merci de votre intérêt pour contribuer à ChatSecure ! 🎉

## 🚀 Démarrage Rapide

1. Fork le repository
2. Clone votre fork : `git clone https://github.com/votre-username/ChatSecure.git`
3. Créez une branche : `git checkout -b feature/ma-fonctionnalite`
4. Installez les dépendances : `npm run install:all`
5. Configurez votre environnement (voir README.md)

## 📝 Standards de Code

### JavaScript/Node.js
- Utiliser ESLint (configuration incluse)
- Respecter les conventions de nommage camelCase
- Commenter le code complexe
- Gérer les erreurs proprement

### React
- Utiliser les hooks modernes
- Composants fonctionnels uniquement
- Props validation avec PropTypes (optionnel)
- CSS modules ou styled-components

### Base de données
- Utiliser Sequelize ORM
- Créer des migrations pour les changements de schéma
- Documenter les relations

## 🔒 Sécurité

- **Ne jamais** commiter de secrets (`.env`, clés privées)
- **Toujours** valider les entrées utilisateur
- **Toujours** échapper les sorties HTML
- **Toujours** utiliser des requêtes paramétrées

## 🧪 Tests

Avant de soumettre une PR :
- Vérifier que le code compile sans erreurs
- Tester les fonctionnalités ajoutées/modifiées
- Vérifier qu'il n'y a pas de régressions

## 📋 Format des Commits

Utiliser des messages de commit clairs :
```
feat: Ajouter fonctionnalité de bannissement
fix: Corriger bug de déchiffrement
docs: Mettre à jour README
refactor: Réorganiser structure des routes
```

## 🔍 Pull Requests

1. Assurez-vous que votre code respecte les standards
2. Ajoutez des tests si nécessaire
3. Mettez à jour la documentation si besoin
4. Décrivez clairement vos changements dans la PR

## ❓ Questions

Si vous avez des questions, ouvrez une issue ou contactez les mainteneurs.

Merci ! 🙏

