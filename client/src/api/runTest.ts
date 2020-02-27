import { TestResult, TestStatus } from "../TestResults";

function enumFromStatusString(status: string): string {
  switch (status) {
    case "failed":
      return TestStatus.FAILURE;

    case "pending":
      return TestStatus.PENDING;

    case "passed":
      return TestStatus.SUCCESS;

    case "skipped":
      return TestStatus.SKIPPED;

    case "running":
      return TestStatus.RUNNING;
  }
  console.error("Unknown enum ", status);
  return "none";
}

export default async (domain: string, test: string): Promise<TestResult[]> => {
  const apiResult: any = await new Promise<TestResult[]>((resolve, reject) => {
    const evtSource = new EventSource(
      `${process.env.REACT_APP_API_HOST ||
        ""}/run?domain=${domain}&test=${test}`,
    );
    evtSource.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.results) {
        resolve(message.results);
        evtSource.close();
      }
    });

    evtSource.onerror = (e) => {
      console.error(e);
      reject();
      evtSource.close();
    };
  });
  const results: TestResult[] = apiResult.testResults[0].assertionResults.map(
    (testResult: any) => {
      if (testResult.status === "pending") {
        /*
        Jest json test results do not have a 'skipped' status. Instead, skipped
        tests come back with pending status. Since we know the test completed,
        we can assume a 'pending' testResult.status is actually a skipped test.

        https://jestjs.io/docs/en/configuration#testresultsprocessor-string
        */
        testResult.status = "skipped";
      }
      return {
        name: [...testResult.ancestorTitles, testResult.title].join(" > "),
        status: enumFromStatusString(testResult.status),
        failureMessages: testResult.failureMessages,
      };
    },
  );
  return results;
};
