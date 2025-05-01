import "./App.css";
import RepoBrowser from "./components/RepoBrowser";

function App() {
  return (
    <div className="app">
      <header className="header">
        <h1 className="title">CODEX</h1>
        <p className="subtitle">BRUTALIST DEV ENVIRONMENT</p>
      </header>

      <main className="main">
        <div className="browser-container">
          <RepoBrowser />
        </div>
      </main>

      <footer className="footer">
        <p>© {new Date().getFullYear()} CODEX. MIT LICENSE.</p>
      </footer>
    </div>
  );
}

export default App;
