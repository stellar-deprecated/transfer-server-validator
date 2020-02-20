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
  const [domain, setDomain] = useState("https://testanchor.stellar.org");
  const [runOptionalTests, setRunOptionalTests] = useState<boolean>(
    Boolean(parseInt(process.env.RUN_OPTIONAL_TESTS || "0")) || false
  );

  useEffect(() => {
    const fetchList = async () => {
      const res = await fetch("/list");
      const list: string[] = await res.json();
      setTestList(
        list.map((name) => {
          let status = TestStatus.PENDING;
          if (name.includes(".optional")) {
            status = TestStatus.SKIPPED
          };
          return {
            name: name,
            results: [],
            status: status,
            numFailedTests: 0,
            numPassedTests: 0,
          };
        }),
      );
    };
    fetchList();
  }, []);

  useEffect(() => {
    const changeOptionalTestStatuses = () => {
      setTestList(testList.map((test) => {
        let op_status = runOptionalTests ? TestStatus.PENDING : TestStatus.SKIPPED;
        if (test.name.includes("optional")) {
          test.status = op_status;
        };
        return test;
      }));
    };
    changeOptionalTestStatuses()
  // eslint-disable-next-line
  }, [runOptionalTests]);

  const runTests = useCallback(
    async (_) => {
      try {
        setBusy(true);
        var nextTest: TestResultSet | undefined;
        while (
          (nextTest = testList.find(
            (result) => result.status === TestStatus.PENDING,
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
    [testList, domain],
  );

  return (
    <div className="App">
      <div className={s.DomainFieldRow}>
        <input
          className={s.DomainField}
          type="text"
          value={domain}
          placeholder="home_domain"
          onChange={(e) => setDomain(e.target.value)}
        ></input>
        <button
          className={s.ValidateButton}
          onClick={runTests}
          disabled={busy}
        >
          {busy ? "Running..." : "Run tests"}
        </button>
      </div>
      <div className={s.FieldRow}>
        <span className={s.FieldLabel}>Run optional tests: </span>
        <input
          className={s.CheckboxField}
          type="checkbox"
          checked={runOptionalTests}
          onChange={(e) => setRunOptionalTests(e.target.checked)}
        ></input>
      </div>
      <ErrorMessage message={errorMessage} />
      <TestList testList={testList} />
    </div>
  );
}

export default App;
