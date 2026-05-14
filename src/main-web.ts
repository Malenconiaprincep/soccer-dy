import './style.css';
import { installWebAdapter } from './adapter/web';
import { bootstrap } from './bootstrap';

installWebAdapter();
void bootstrap('web');
