import { config } from "./config";

const shouldRunProgram = !process.argv?.[1].includes("jest");

if (shouldRunProgram) {
  const dateParam = process.argv[2];
  const date = dateParam
    ? new Date(dateParam).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  main({ startDate: `${date}T00:00:00Z`, endDate: `${date}T23:59:59Z` });
}

export async function main({ startDate, endDate }: Dates) {
  return fetchTimeEntriesForToday({ startDate, endDate })
    .then(formatResponse)
    .then(groupByTicketNumber)
    .then(presentResult)
    .catch((error) => {
      console.error("Error fetching time entries:", error);
      throw error;
    });
}

async function fetchTimeEntriesForToday({
  startDate,
  endDate,
}: Dates): Promise<TogglTimeEntry[]> {
  const response = await fetch(
    `https://api.track.toggl.com/api/v9/me/time_entries?start_date=${startDate}&end_date=${endDate}`,
    {
      method: "GET",
      headers: {
        Authorization: `Basic ${config.TOGGLE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Error: ${response.status} - ${response.statusText}`);
  }

  return await response.json();
}

function formatResponse(timeEntries: TogglTimeEntry[]): {
  totalDurationInMinutes: number;
  entries: Entry[];
} {
  return timeEntries
    .filter((entry) => entry.description && entry.duration > 0)
    .map((entry) => ({
      description: entry.description,
      durationInMinutes: Math.round(entry.duration / 60),
    }))
    .reduce(
      (acc, curr) => ({
        totalDurationInMinutes:
          acc.totalDurationInMinutes + curr.durationInMinutes,
        entries: [...acc.entries, curr],
      }),
      { totalDurationInMinutes: 0, entries: [] } as {
        totalDurationInMinutes: number;
        entries: Entry[];
      }
    );
}

function groupByTicketNumber({
  totalDurationInMinutes,
  entries,
}: {
  totalDurationInMinutes: number;
  entries: Entry[];
}) {
  return {
    totalDurationInMinutes,
    groupedEntries: entries.reduce(
      (acc, curr) => {
        const ticketAndDescription = curr.description.split(":");
        const [ticketNumber = "unknown", description = ""] =
          ticketAndDescription.length > 1
            ? ticketAndDescription
            : ["unknown", ...ticketAndDescription];
        const previous = acc[ticketNumber];
        const previousDescription = previous?.description ?? "";
        const currentDescription = description.trim();
        const sameDescriptionForTimeEntry =
          previousDescription.includes(currentDescription);

        return {
          ...acc,
          [ticketNumber]: {
            totalDurationInMinutes:
              (previous?.totalDurationInMinutes ?? 0) + curr.durationInMinutes,
            description: `${previousDescription}${
              previousDescription && !sameDescriptionForTimeEntry ? ". " : ""
            }${!sameDescriptionForTimeEntry ? currentDescription : ""}`,
            entries: [
              ...(previous?.entries ?? []),
              {
                ...curr,
                description: currentDescription,
              },
            ],
          },
        };
      },
      {} as Record<
        string,
        {
          totalDurationInMinutes: number;
          description: string;
          entries: Entry[];
        }
      >
    ),
  };
}

function presentResult({
  totalDurationInMinutes,
  groupedEntries,
}: {
  totalDurationInMinutes: number;
  groupedEntries: Record<
    string,
    {
      totalDurationInMinutes: number;
      description: string;
      entries: Entry[];
    }
  >;
}) {
  console.log(
    `Total time: ${minutesToTimeString(
      totalDurationInMinutes
    )} / ${minutesToTimeString(
      roundToNearestMinutes(totalDurationInMinutes)
    )}\n`
  );

  console.table(groupedEntries);

  const worklogs = Object.entries(groupedEntries).map(([ticket, value]) => {
    const timeStr = minutesToTimeString(
      roundToNearestMinutes(value.totalDurationInMinutes)
    );
    const desc = value.description || "No description";

    return `jira issue worklog add ${ticket} "${timeStr}" --comment "${desc}" --no-input`;
  });

  console.log(worklogs.join("\n"));

  return {
    totalDurationInMinutes,
    groupedEntries,
    worklogs,
  };
}

function roundToNearestMinutes(minutes: number, roundToMinutes = 10): number {
  return Math.ceil(minutes / roundToMinutes) * roundToMinutes;
}

function minutesToTimeString(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

interface Entry {
  description: string;
  durationInMinutes: number;
}

interface Dates {
  startDate: string;
  endDate: string;
}

export interface TogglTimeEntry {
  id: number;
  workspace_id: number;
  project_id: number | null;
  task_id: number | null;
  billable: boolean;
  start: string;
  stop: string;
  duration: number;
  description: string;
  tags: string[];
  tag_ids: number[];
  duronly: boolean;
  at: string;
  server_deleted_at: string | null;
  user_id: number;
  uid: number;
  wid: number;
  permissions: unknown | null;
}
