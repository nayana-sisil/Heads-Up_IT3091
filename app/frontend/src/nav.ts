export type Mode = 'use' | 'built'
export interface PageDef { id: string; label: string; short: string; icon: string; mode: Mode; title: string; sub: string; group?: string }
export const PAGES: PageDef[] = [
  { id: 'home', label: 'Home', short: 'Home', icon: 'today', mode: 'use', title: 'Home', sub: 'What needs your attention today' },
  { id: 'check', label: 'Check an order', short: 'Check', icon: 'check', mode: 'use', title: 'Check an order', sub: 'Will this order arrive late? Find out before it ships' },
  { id: 'file', label: 'Score a file', short: 'File', icon: 'upload', mode: 'use', title: 'Score a file', sub: 'Rank a whole list of new orders in one go' },
  { id: 'handle', label: 'Orders to handle', short: 'Orders', icon: 'list', mode: 'use', title: 'Orders to handle', sub: 'The orders worth your time, biggest and riskiest first' },
  { id: 'capacity', label: 'Team capacity', short: 'Capacity', icon: 'capacity', mode: 'use', title: 'Team capacity', sub: 'How much late revenue can your team reach?' },
  { id: 'replay', label: 'Replay', short: 'Replay', icon: 'replay', mode: 'use', title: 'Replay', sub: 'Watch the queue week by week' },
  { id: 'business', label: 'Business case', short: 'Business', icon: 'briefcase', mode: 'use', title: 'Business case', sub: 'Why this tool exists, who uses it and what it is worth' },
  { id: 'trust', label: 'Trust and limits', short: 'Trust', icon: 'trust', mode: 'use', title: 'Trust and limits', sub: 'How good the model is, and where it is weak' },

  { id: 'problem', label: '1. Problem and target', short: '1', icon: 'target', mode: 'built', title: 'Problem and target', sub: 'What we predict, for whom, and how we judge it', group: 'The project' },
  { id: 'data', label: '2. Data and EDA', short: '2', icon: 'data', mode: 'built', title: 'Data and exploration', sub: 'What the data looks like and what it told us', group: 'The project' },
  { id: 'prep', label: '3. Cleaning and split', short: '3', icon: 'clean', mode: 'built', title: 'Cleaning and splitting', sub: 'From order lines to a safe train, validation and test set', group: 'The project' },
  { id: 'features', label: '4. Features', short: '4', icon: 'layers', mode: 'built', title: 'Feature engineering', sub: 'The 28 inputs the model sees, and how each is built', group: 'The project' },
  { id: 'models', label: '5. Models', short: '5', icon: 'models', mode: 'built', title: 'Baseline and model comparison', sub: 'Twelve models against a simple rule', group: 'The project' },
  { id: 'tuning', label: '6. Tuning and threshold', short: '6', icon: 'dial', mode: 'built', title: 'Tuning and the threshold', sub: 'How the settings and the flag line were chosen', group: 'The project' },
  { id: 'explain', label: '7. Explainability', short: '7', icon: 'brain', mode: 'built', title: 'Explainability', sub: 'What the model uses, and why one order is risky', group: 'The project' },
  { id: 'final', label: '8. Final evaluation', short: '8', icon: 'flag', mode: 'built', title: 'Final evaluation', sub: 'Random Forest and XGBoost on data they never saw', group: 'The project' },
  { id: 'priority', label: '9. Prioritization', short: '9', icon: 'rank', mode: 'built', title: 'Shipment prioritization', sub: 'Turning chances into a ranked queue', group: 'The project' },
  { id: 'system', label: '10. The app itself', short: '10', icon: 'server', mode: 'built', title: 'How the app works', sub: 'Architecture, checks and how to run it', group: 'The project' },
  { id: 'decisions', label: 'Decision log', short: 'Log', icon: 'log', mode: 'built', title: 'Decision log', sub: 'Every choice we made, with the reason', group: 'Reference' },
  { id: 'viva', label: 'Viva cheat sheet', short: 'Viva', icon: 'help', mode: 'built', title: 'Viva cheat sheet', sub: 'Likely questions, short answers, and where the proof is', group: 'Reference' },
  { id: 'about', label: 'About', short: 'About', icon: 'info', mode: 'built', title: 'About the project', sub: 'Team, course and dataset', group: 'Reference' },
]
export const pageOf = (id: string) => PAGES.find(p => p.id === id)
