import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { main, TogglTimeEntry } from "./";

beforeAll(() => server.listen());

afterEach(() => server.resetHandlers());

afterAll(() => server.close());

const server = setupServer(
  http.get("https://api.track.toggl.com/api/v9/me/time_entries", () => {
    const events: TogglTimeEntry[] = [
      {
        id: 1,
        workspace_id: 123,
        project_id: null,
        task_id: null,
        billable: true,
        start: "2024-10-25T08:00:00Z",
        stop: "2024-10-25T12:00:00Z",
        duration: 60 * 60,
        description: "DEV-123: Work on feature",
        tags: [],
        tag_ids: [],
        duronly: false,
        at: "2024-10-25T12:00:00Z",
        server_deleted_at: null,
        user_id: 456,
        uid: 456,
        wid: 123,
        permissions: null,
      },
      {
        id: 1,
        workspace_id: 123,
        project_id: null,
        task_id: null,
        billable: true,
        start: "2024-10-25T08:00:00Z",
        stop: "2024-10-25T12:00:00Z",
        duration: 60 * 60,
        description: "DEV-123: Work on feature again",
        tags: [],
        tag_ids: [],
        duronly: false,
        at: "2024-10-25T12:00:00Z",
        server_deleted_at: null,
        user_id: 456,
        uid: 456,
        wid: 123,
        permissions: null,
      },
      {
        id: 1,
        workspace_id: 123,
        project_id: null,
        task_id: null,
        billable: true,
        start: "2024-10-25T08:00:00Z",
        stop: "2024-10-25T12:00:00Z",
        duration: 60 * 30,
        description: "DEV-1234: Work on feature",
        tags: [],
        tag_ids: [],
        duronly: false,
        at: "2024-10-25T12:00:00Z",
        server_deleted_at: null,
        user_id: 456,
        uid: 456,
        wid: 123,
        permissions: null,
      },
      // No description should be filtered away
      {
        id: 1,
        workspace_id: 123,
        project_id: null,
        task_id: null,
        billable: true,
        start: "2024-10-25T08:00:00Z",
        stop: "2024-10-25T12:00:00Z",
        duration: 60 * 30,
        description: "",
        tags: [],
        tag_ids: [],
        duronly: false,
        at: "2024-10-25T12:00:00Z",
        server_deleted_at: null,
        user_id: 456,
        uid: 456,
        wid: 123,
        permissions: null,
      },
      {
        id: 1,
        workspace_id: 123,
        project_id: null,
        task_id: null,
        billable: true,
        start: "2024-10-25T08:00:00Z",
        stop: "2024-10-25T12:00:00Z",
        duration: 60 * 30,
        description: "No ticket number",
        tags: [],
        tag_ids: [],
        duronly: false,
        at: "2024-10-25T12:00:00Z",
        server_deleted_at: null,
        user_id: 456,
        uid: 456,
        wid: 123,
        permissions: null,
      },
    ];

    return Response.json(events);
  })
);

test("it should fetch time entries from toggl and display them in jira worklog format", async () => {
  const result = await main({ startDate: "2024-10-29", endDate: "2024-10-29" });

  expect(result).toEqual({
    groupedEntries: {
      "DEV-123": {
        description: "Work on feature. Work on feature again",
        entries: [
          { description: "Work on feature", durationInMinutes: 60 },
          { description: "Work on feature again", durationInMinutes: 60 },
        ],
        totalDurationInMinutes: 120,
      },
      "DEV-1234": {
        description: "Work on feature",
        entries: [{ description: "Work on feature", durationInMinutes: 30 }],
        totalDurationInMinutes: 30,
      },
      unknown: {
        description: "No ticket number",
        entries: [{ description: "No ticket number", durationInMinutes: 30 }],
        totalDurationInMinutes: 30,
      },
    },
    totalDurationInMinutes: 180,
    worklogs: [
      'jira issue worklog add DEV-123 "2h 0m" --comment "Work on feature. Work on feature again" --no-input',
      'jira issue worklog add DEV-1234 "0h 30m" --comment "Work on feature" --no-input',
      'jira issue worklog add unknown "0h 30m" --comment "No ticket number" --no-input',
    ],
  });
});

test("it should handle error if toggle API throws", async () => {
  server.use(
    http.get("https://api.track.toggl.com/api/v9/me/time_entries", () => {
      return new HttpResponse(null, {
        status: 500,
        statusText: "Error fetching time entries",
      });
    })
  );

  await expect(
    main({ startDate: "2024-10-29T00:00:00Z", endDate: "2024-10-29T23:59:59Z" })
  ).rejects.toThrow("Error: 500 - Error fetching time entries");
});
