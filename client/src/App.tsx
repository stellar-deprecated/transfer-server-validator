import React, { useCallback, useState, useEffect } from "react";

import "./App.css";
import ErrorMessage from "./ErrorMessage";
import TestList from "./TestList";
import { TestResultSet, TestStatus } from "./TestResults";
import runTest from "./api/runTest";
import s from "./App.module.css";

type ResultList = TestResultSet[];
function App() {
  const [errorMessage, setErrorMessage] = useState<String | null>(null);
  const [testList, setTestList] = useState<ResultList>([]);
  const [busy, setBusy] = useState<boolean>(false);
  const [domain, setDomain] = useState(
    "https://stellar-anchor-server.herokuapp.com"
  );

  useEffect(() => {
    const fetchList = async () => {
      const res = await fetch("/list");
      const list: string[] = await res.json();
      setTestList(
        list.map(name => {
          return {
            name: name,
            results: [],
            status: TestStatus.PENDING,
            numFailedTests: 0,
            numPassedTests: 0
          };
        })
      );
    };
    fetchList();
  }, []);

  const runAllTests = useCallback(
    async _ => {
      try {
        setBusy(true);
        var nextTest: TestResultSet | undefined;
        while (
          (nextTest = testList.find(
            result => result.status === TestStatus.PENDING
          )) !== undefined
        ) {
          nextTest.status = TestStatus.RUNNING;
          setTestList([...testList]);
          nextTest.results = await runTest(domain, nextTest.name);
          setTestList([...testList]);
        }
      } catch (e) {
        setErrorMessage("Something went wrong!");
        console.error(e);
      }
      setBusy(false);
    },
    [testList, domain]
  );

  return (
    <div className="App">
      <div className={s.DomainFieldRow}>
        <input
          className={s.DomainField}
          type="text"
          value={domain}
          placeholder="home_domain"
          onChange={e => setDomain(e.target.value)}
        ></input>
        <button
          className={s.ValidateButton}
          onClick={runAllTests}
          disabled={busy}
        >
          {busy ? "Running..." : "Run all tests"}
        </button>
      </div>
      <ErrorMessage message={errorMessage} />
      <TestList testList={testList} />
    </div>
  );
}

export default App;
