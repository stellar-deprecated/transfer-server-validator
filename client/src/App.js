import React, { useCallback, useState } from "react";

import "./App.css";
import DomainInput from "./DomainInput";
import Loading from "./Loading";
import ResultSet from "./ResultSet";
import ErrorMessage from "./ErrorMessage";

function App() {
  const [results, setResults] = useState(null);
  const [isLoading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const runValidation = useCallback(async domain => {
    setLoading(true);
    setResults(null);
    setErrorMessage(null);
    try {
      const response = await fetch("/run?domain=" + domain);
      //todo error handle
      const json = await response.json();
      setResults(json);
    } catch (e) {
      console.log(e);
      setErrorMessage("Something went wrong");
    }
    setLoading(false);
  }, []);

  return (
    <div className="App">
      <DomainInput onValidateClick={runValidation} isLoading={isLoading} />
      <Loading active={isLoading} />
      <ResultSet results={results} />
      <ErrorMessage message={errorMessage} />
    </div>
  );
}

export default App;
