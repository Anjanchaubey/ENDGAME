import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import './apple-design.css';

class FailureBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="boot"><div className="brand-mark">E</div><h2>Control room unavailable.</h2><p>Reload ENDGAME to restore the command center.</p><button className="secondary" onClick={() => window.location.reload()}>Reload</button></div> : this.props.children; }
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><FailureBoundary><App /></FailureBoundary></BrowserRouter></React.StrictMode>);
