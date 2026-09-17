# Bastion 3D — Tower Defense Action-RPG

Un tower defense 3D jouable dans le navigateur où vous incarnez directement un
personnage sur le champ de bataille (vue troisième personne) tout en
construisant et améliorant des tours pour protéger un cristal central, face à
des vagues d'ennemis de plus en plus difficiles.

Construit avec **Three.js** + **Vite**, sans moteur de jeu externe : tout le
rendu 3D, la physique légère, le pathfinding et les systèmes de jeu sont
implémentés en JavaScript pur.

## Lancer le jeu

```bash
npm install
npm run dev
```

Puis ouvrez l'URL indiquée (par défaut `http://localhost:5173`). Cliquez une
fois sur la scène pour activer l'audio et le contrôle de la caméra à la
souris (pointer lock).

`npm run build` génère une version de production dans `dist/` (servable par
n'importe quel serveur statique).

## Contrôles

| Touche | Action |
|---|---|
| Z / Q / S / D | Déplacement (AZERTY) |
| Souris | Caméra orbitale troisième personne / visée |
| Molette | Change le type de tour sélectionné pour la construction |
| Espace | Saut |
| Maj (gauche) | Sprint (consomme l'endurance) |
| Ctrl (gauche) / double-tap direction | Dash avec frames d'invincibilité |
| Clic gauche | Attaque au corps-à-corps (arc frontal) |
| Clic droit | Attaque à distance |
| A / E / R / F | Compétences actives (Tourbillon, Tir Chargé, Pulsation de Réparation, Surcharge) |
| 1-7 | Sélection rapide d'un type de tour + entrée en mode construction |
| B | Bascule le mode construction |
| Clic gauche (en mode construction) / F | Placer la tour au réticule |
| Échap | Annule la construction, ou Pause |
| F (hors construction, près d'une tour) | Ouvre le panneau de gestion de la tour (amélioration, spécialisation, ciblage, rune, vente) |
| Tab (maintenu) | Carte tactique — met le combat en pause |
| K | Arbre de compétences du personnage |
| I | Équipement / inventaire |
| N | Lance la vague immédiatement (bonus d'or pour la prise de risque) |

## Systèmes implémentés

- **Personnage jouable** : déplacement relatif à la caméra, saut, sprint avec
  jauge d'endurance, dash avec i-frames, combat au corps-à-corps et à
  distance, 4 compétences actives avec cooldowns, XP/niveaux, arbre de
  compétences à 3 branches (Combat rapproché / Magie à distance /
  Soutien-Ingénieur), équipement (arme/armure) avec raretés et stats
  aléatoires.
- **Tours** : 7 types (balistique, mage, zone, soutien, contrôle, anti-aérien,
  piège), placement avec preview fantôme et vérification A* garantissant
  qu'un chemin reste toujours ouvert, 5 niveaux avec spécialisation au
  niveau 3, fusion de 3 tours niveau max en version hybride, réparation,
  modes de ciblage (plus proche/premier/dernier/plus de vie).
- **Runes** : emplacements débloqués progressivement avec le niveau de la
  tour (1 au niveau 2, 2 au niveau 3, 3 au niveau max), 9 runes réparties en
  4 familles (Puissance, Portée, Cadence, Statuts élémentaires) sur 2 paliers
  de puissance. Ajouter une rune propose un choix de 3 runes aléatoires
  payées en cristaux — une vraie décision plutôt qu'un tirage aléatoire subi
  — et chaque rune équipée s'affiche visuellement (gemme colorée) sur la
  tour. Les runes sont retirables (sans remboursement).
- **Vagues** : courbe de difficulté non linéaire avec paliers, vagues élites
  tous les 5 niveaux (modificateurs aléatoires), vagues de boss tous les 10
  niveaux (plusieurs phases, attaque téléguidée interceptible en infligeant
  des dégâts au boss pendant la préparation), vagues multi-chemins à partir
  de la vague 8/20, prévisualisation des ennemis à venir, lancement anticipé
  contre bonus d'or.
- **Ennemis** : 8 archétypes (basique, rapide, blindé, volant, régénérant,
  invisible, kamikaze, invocateur) + 2 boss multi-phases, pathfinding A* sur
  grille recalculé à chaque construction de tour.
- **Économie** : or, cristaux (rares, sur élites/boss), intérêts passifs
  entre les vagues, PV de base.
- **Méta-progression** : Essence persistante (localStorage) gagnée en fin de
  run, arbre de talents permanents (or de départ, PV, réduction de coût,
  déblocage de classe/carte), 4 niveaux de difficulté, modificateurs de run
  (malédictions/bénédictions), mode Bac à Sable (base indestructible),
  succès.
- **HUD complet** : vitales, PV de base, or/cristaux, aperçu de vague,
  minicarte, panneau de tour, notifications, nombres de dégâts flottants,
  carte tactique (Tab).
- **Audio/VFX** : SFX procéduraux (Web Audio API, pas d'assets externes),
  musique dynamique dont l'intensité suit le combat, camera shake, particules
  simples (anneaux, explosions, télégraphes de boss).

## Architecture

```
src/
  core/        InputManager, CameraRig, AudioManager, SaveManager, EventBus
  world/       Grid, Pathfinding (A*), Level, biomes
  entities/    Player, Enemy, Boss, Tower, Projectile
  systems/     ProgressionManager, TowerManager, WaveManager, EconomyManager,
               MetaProgression, VFX, StatusEffects
  data/        Définitions pures (towers, enemies, skills, items, meta, waves)
  ui/          HUD, Modals (compétences/inventaire/pause/carte), StartMenu
  Game.js      Orchestrateur central (boucle de jeu, câblage des systèmes)
```

Le jeu est entièrement piloté par la donnée : ajouter une tour, un ennemi ou
une compétence se fait en ajoutant une entrée dans `src/data/*.js`.

## Simplifications assumées (hors scope de cette passe)

Le cahier des charges est très large (façon jeu commercial complet). Pour
livrer quelque chose de réellement jouable, certains points ont été
simplifiés :

- **Un seul biome pleinement modélisé** (Vallée Assiégée) ; Forêt et Désert
  existent comme palettes/biomes de données prêtes à l'emploi (débloquables
  via les talents permanents) mais réutilisent le même layout de grille.
- **Pas de coop réseau** : l'architecture (EventBus, systèmes découplés) s'y
  prête, mais l'implémentation d'un netcode (Netcode for GameObjects
  équivalent) est hors scope ici. Le mode "Bac à sable" et un seul joueur
  local sont fonctionnels.
- **Pas d'objets destructibles au sol** distincts des ennemis (l'or provient
  des kills, des vagues et des intérêts, comme indiqué dans le cahier des
  charges, mais pas d'obstacles destructibles séparés).
- **Runes/gemmes** : 9 runes sur 4 familles avec choix stratégique et
  emplacements limités (voir plus haut), mais pas de système de combinaisons
  entre runes (fusionner deux runes en une variante unique, par exemple).
- **Assets** : géométries procédurales colorées (pas de modèles 3D texturés)
  et SFX synthétisés au lieu de samples audio — cohérent avec un projet code
  sans pipeline d'art, mais visuellement minimaliste.

## Bugs corrigés pendant le développement

- Convention de pitch de la caméra inversée (la caméra passait sous le sol,
  provoquant le culling de la face du plan de sol).
- Plan de sol trop petit : son bord finissait dans le champ de vision à
  distance — agrandi très au-delà de la grille jouable.
- Collision de caméra ajoutée (raycast) contre les obstacles et les tours
  pour éviter que la caméra ne traverse la géométrie.
- `WaveManager.update()` n'était jamais appelé depuis la boucle de jeu : les
  vagues ne démarraient jamais. Corrigé et vérifié par un cycle de jeu
  complet (apparition → dégâts à la base → vague suivante).
