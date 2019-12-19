import React, { useCallback, useState } from "react";

import "./App.css";
import DomainInput from "./DomainInput";
import Loading from "./Loading";
import ResultSet from "./ResultSet";

function App() {
  const [results, setResults] = useState(null);
  const [isLoading, setLoading] = useState(false);
  const runValidation = useCallback(async domain => {
    setLoading(true);
    setResults(null);
    const response = await fetch("http://localhost:3000/run?domain=" + domain);
    const json = await response.json();
    setResults(json);
    setLoading(false);
  }, []);

  return (
    <div className="App">
      <DomainInput onValidateClick={runValidation} isLoading={isLoading} />
      <Loading active={isLoading} />
      <ResultSet results={results} />
    </div>
  );
}

export default App;
