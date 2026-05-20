import './style.css';
import { GameApp } from './game/GameApp';

const mount = document.querySelector<HTMLDivElement>('#app');

if (!mount) {
  throw new Error('Missing #app mount node');
}

const game = new GameApp(mount);
Object.assign(globalThis, { __soccerGame: game });
Object.assign(window, { __soccerGame: game });
void game.start();
