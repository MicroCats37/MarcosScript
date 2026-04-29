/* @refresh reload */
import { render } from 'solid-js/web';
import { Router, Route } from '@solidjs/router';
import './index.css';
import App, { EmptyState } from './App';
import { EventDetail } from './components/EventDetail';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

render(() => (
  <Router>
    {/* App actúa como Layout base */}
    <Route path="/" component={App}>
      {/* Rutas hijas que se inyectarán en props.children de App */}
      <Route path="/" component={EmptyState} />
      <Route path="/events/:id" component={EventDetail} />
    </Route>
  </Router>
), root);
