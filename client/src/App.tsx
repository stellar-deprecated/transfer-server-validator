import React, { useCallback, useState, useEffect } from "react";

import "./App.css";
import ErrorMessage from "./ErrorMessage";
import TestList from "./TestList";
import { TestResultSet, TestStatus, makeTestResultSet } from "./TestResults";
import runTest from "./api/runTest";
import s from "./App.module.css";

function App() {
  const [errorMessage, setErrorMessage] = useState<String | null>(null);
  // All tests available from the server
  const [availableTests, setAvailableTests] = useState<string[]>([]);
  // Current (pending) test runs
  const [testList, setTestList] = useState<TestResultSet[]>([]);
  const [busy, setBusy] = useState<boolean>(false);
  const [domain, setDomain] = useState("testanchor.stellar.org");
  const [runOptionalTests, setRunOptionalTests] = useState<boolean>(
    Boolean(parseInt(process.env.RUN_OPTIONAL_TESTS || "0")) || false,
  );

  useEffect(() => {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const domain = urlParams.get("home_domain");
    if (domain) {
      setDomain(domain);
    }
    const fetchList = async () => {
      const res = await fetch(`${process.env.REACT_APP_API_HOST || ""}/list`);
      const testNames: string[] = await res.json();
      setAvailableTests(testNames);
    };
    fetchList();
  }, []);

  const resetTests = useCallback(() => {
    setTestList(availableTests.map(makeTestResultSet));
  }, [availableTests]);
  useEffect(resetTests, [availableTests]);

  useEffect(() => {
    const changeOptionalTestStatuses = () => {
      setTestList((previousTestList) => {
        return previousTestList.map((test) => {
          let opStatus = runOptionalTests
            ? TestStatus.PENDING
            : TestStatus.SKIPPED;
          if (test.name.includes("optional")) {
            test.status = opStatus;
          }
          return test;
        });
      });
    };
    changeOptionalTestStatuses();
  }, [runOptionalTests]);

  const getValidDomain = useCallback(() => {
    let newDomain = domain;
    if (newDomain.indexOf("http") !== 0) {
      newDomain = `https://${newDomain}`;
    }
    newDomain =
      newDomain.substr(-1) === "/" ? newDomain.slice(0, -1) : newDomain;
    return newDomain;
  }, [domain]);

  const runTests = useCallback(
    async (_) => {
      try {
        resetTests();
        setBusy(true);
        const domainForTests = getValidDomain();
        window.history.replaceState(null, "", `?home_domain=${domain}`);
        var nextTest: TestResultSet | undefined;
        while (
          (nextTest = testList.find(
            (result) => result.status === TestStatus.PENDING,
          )) !== undefined
        ) {
          nextTest.status = TestStatus.RUNNING;
          setTestList([...testList]);
          nextTest.results = await runTest(domainForTests, nextTest.name);
          nextTest.status = nextTest.results.every((result) => {
            return [TestStatus.SUCCESS, TestStatus.SKIPPED].includes(
              result.status,
            );
          })
            ? TestStatus.SUCCESS
            : TestStatus.FAILURE;
          setTestList([...testList]);
        }
      } catch (e) {
        setErrorMessage("Something went wrong!");
        console.error(e);
      }
      setBusy(false);
    },
    [testList, domain, getValidDomain, resetTests],
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
        <button className={s.ValidateButton} onClick={runTests} disabled={busy}>
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
