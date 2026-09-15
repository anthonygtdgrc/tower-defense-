import { SaveManager } from './core/SaveManager.js';
import { MetaProgression } from './systems/MetaProgression.js';
import { StartMenu } from './ui/StartMenu.js';
import { Game } from './Game.js';

const saveManager = new SaveManager();
const meta = new MetaProgression(saveManager);

const menuRoot = document.getElementById('menu-root');
const hudRoot = document.getElementById('hud-root');
const canvas = document.getElementById('scene');

hudRoot.style.display = 'none';

const startMenu = new StartMenu(menuRoot, saveManager, meta);
startMenu.render((config) => {
  saveManager.data.settings.difficulty = config.difficulty;
  saveManager.save();
  startMenu.hide();
  hudRoot.style.display = '';

  const game = new Game({ canvas, hudRoot, menuRoot, saveManager, metaProgression: meta, config });
  game.start();
  window.__bastionGame = game; // debugging hook
});
