import React, { useCallback, useState, useEffect } from "react";

import "./App.css";
import ErrorMessage from "./ErrorMessage";
import TestList from "./TestList";
import { TestResultSet, TestStatus, makeTestResultSet } from "./TestResults";
import runTest from "./api/runTest";
import s from "./App.module.css";
import TOML from "toml";

function App() {
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);
  const [errorMessage, setErrorMessage] = useState<String | null>(null);
  // All tests available from the server
  const [availableTests, setAvailableTests] = useState<string[]>([]);
  // Current (pending) test runs
  const [testList, setTestList] = useState<TestResultSet[]>([]);
  const [busy, setBusy] = useState<boolean>(false);
  const [domain, setDomain] = useState(
    urlParams.get("home_domain") || "testanchor.stellar.org",
  );
  const projectFromURL = urlParams.get("project") || "";
  const [sepSelect, setSepSelect] = useState<string>(
    ["SEP6", "SEP24", "SEP31"].includes(projectFromURL)
      ? projectFromURL
      : "SEP24",
  );
  const [wrongNetworkError, setWrongNetworkError] = useState<String | null>(
    null,
  );
  const [currency, setCurrency] = useState<string>("");
  const [runOptionalTests, setRunOptionalTests] = useState<boolean>(
    Boolean(parseInt(process.env.RUN_OPTIONAL_TESTS || "0")),
  );
  const [runOnMainnet, setRunOnMainnet] = useState<boolean>(
    Boolean(parseInt(process.env.MAINNET || "0")),
  );

  const fetchList = async (project: string) => {
    const res = await fetch(
      `${process.env.REACT_APP_API_HOST || ""}/list?project=${project}`,
    );
    const testNames: string[] = await res.json();
    setAvailableTests(testNames);
  };

  useEffect(() => {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const currency = urlParams.get("currency");
    const mainnet = urlParams.get("mainnet");
    if (currency) {
      setCurrency(currency);
    }
    if (mainnet) {
      setRunOnMainnet(mainnet === "true" || mainnet === "1");
    }
  }, []);

  const resetTests = useCallback(() => {
    setTestList(
      availableTests.map((test) => {
        return makeTestResultSet(test, runOptionalTests);
      }),
    );
  }, [availableTests, runOptionalTests]);
  useEffect(resetTests, [availableTests]);

  const setDomainArgs = useCallback(() => {
    if (currency) {
      window.history.replaceState(
        null,
        "",
        `?home_domain=${domain}&currency=${currency}&mainnet=${runOnMainnet}&project=${sepSelect}`,
      );
    } else {
      window.history.replaceState(
        null,
        "",
        `?home_domain=${domain}&mainnet=${runOnMainnet}&project=${sepSelect}`,
      );
    }
  }, [currency, domain, sepSelect, runOnMainnet]);

  useEffect(() => {
    resetTests();
  }, [resetTests, runOptionalTests]);

  useEffect(() => {
    const changeProject = async () => {
      await fetchList(sepSelect);
    };
    changeProject();
  }, [sepSelect]);

  const getValidDomain = useCallback(() => {
    let newDomain = domain;
    if (newDomain.indexOf("http") !== 0) {
      newDomain = `https://${newDomain}`;
    }
    newDomain =
      newDomain.substr(-1) === "/" ? newDomain.slice(0, -1) : newDomain;
    return newDomain;
  }, [domain]);

  /*
   * Checks the anchor's TOML for NETWORK_PASSPHRASE and validates that
   * its the correct string depending on runOnMainnet
   */
  const checkAnchorNetwork = useCallback(async () => {
    const url = getValidDomain();
    const tomlURL = url + "/.well-known/stellar.toml";
    let response;
    let text;
    try {
      response = await fetch(tomlURL);
      text = await response.text();
    } catch (e) {
      throw Error("Unable to fetch TOML file. Make sure you have CORS enabled");
    }
    let toml;
    try {
      toml = TOML.parse(text);
    } catch (e) {
      throw Error("Unable to parse TOML file");
    }
    // Doesn't have NETWORK_PASSPHRASE, don't stop them from running tests
    // even if they'll fail due to running on the wrong network
    if (!toml.NETWORK_PASSPHRASE) return;
    if (
      runOnMainnet &&
      toml.NETWORK_PASSPHRASE !==
        "Public Global Stellar Network ; September 2015"
    ) {
      throw Error(
        "This anchor doesn't run on mainnet! Unselect the 'Run on mainnet' checkbox.",
      );
    }
    if (
      !runOnMainnet &&
      toml.NETWORK_PASSPHRASE !== "Test SDF Network ; September 2015"
    ) {
      throw Error(
        "This anchor doesn't run on testnet! Try running on mainnet.",
      );
    }
  }, [runOnMainnet, getValidDomain]);

  useEffect(() => {
    const onRunOnMainnetChange = () => {
      setDomainArgs();
      setWrongNetworkError(null);
    };
    onRunOnMainnetChange();
  }, [runOnMainnet, runOptionalTests, setDomainArgs]);

  const runTests = useCallback(
    async (_) => {
      try {
        resetTests();
        setWrongNetworkError(null);
        setBusy(true);
        const domainForTests = getValidDomain();
        setDomainArgs();
        try {
          await checkAnchorNetwork();
        } catch (e) {
          setWrongNetworkError(e.message);
          setBusy(false);
          return;
        }
        var nextTest: TestResultSet | undefined;
        while (
          (nextTest = testList.find(
            (result) => result.status === TestStatus.PENDING,
          )) !== undefined
        ) {
          nextTest.status = TestStatus.RUNNING;
          setTestList([...testList]);
          nextTest.results = await runTest(
            domainForTests,
            currency,
            runOnMainnet,
            nextTest.name,
            sepSelect,
          );
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
    [
      testList,
      sepSelect,
      currency,
      runOnMainnet,
      setDomainArgs,
      checkAnchorNetwork,
      getValidDomain,
      resetTests,
    ],
  );

  return (
    <>
      <div className="DeprecationWarning">
        This tool is deprecated and is no longer maintained. Use the new version
        of this tool at{" "}
        <a href="https://anchor-tests.stellar.org">anchor-tests.stellar.org</a>.
      </div>
      <div className="App">
        <div className={s.DomainFieldRow}>
          <input
            className={s.DomainField}
            type="text"
            value={domain}
            placeholder="home_domain"
            onChange={(e) => setDomain(e.target.value)}
          ></input>
          <input
            className={s.CurrencyField}
            type="text"
            value={currency}
            placeholder="currency (optional)"
            onChange={(e) => setCurrency(e.target.value)}
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
          <span className={s.FieldLabel}>Select SEP: </span>
          <select
            className={s.DropdownField}
            value={sepSelect}
            onChange={(e) => setSepSelect(e.target.value)}
          >
            <option selected value="SEP24">
              SEP-24
            </option>
            <option value="SEP6">SEP-6</option>
            <option value="SEP31">SEP-31</option>
          </select>
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
        <div className={s.FieldRow}>
          <span className={s.FieldLabel}>Run on mainnet: </span>
          <input
            className={s.CheckboxField}
            type="checkbox"
            checked={runOnMainnet}
            onChange={(e) => setRunOnMainnet(e.target.checked)}
          ></input>
        </div>
        <p hidden={!wrongNetworkError} className={s.ErrorMessage}>
          {wrongNetworkError}
        </p>
        <ErrorMessage message={errorMessage} />
        <TestList testList={testList} />
      </div>
    </>
  );
}

export default App;
