import Docker from "dockerode";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

export async function restartContainer(name: string): Promise<void> {
  const container = docker.getContainer(name);
  await container.restart({ t: 30 });
}

export async function tailLogs(name: string, tail = 200): Promise<string> {
  const container = docker.getContainer(name);
  const buf = (await container.logs({
    stdout: true,
    stderr: true,
    tail,
    timestamps: false,
    follow: false,
  })) as unknown as Buffer;
  // Docker multiplexes stdout/stderr with an 8-byte header per chunk when no
  // TTY is allocated. Strip the headers so we get readable text.
  return demuxLogs(buf);
}

function demuxLogs(buf: Buffer): string {
  const parts: string[] = [];
  let i = 0;
  while (i < buf.length) {
    // Heuristic: if next 8 bytes look like a docker log header
    // (stream type 0/1/2, three zeros, 4-byte big-endian length), strip them.
    if (
      i + 8 <= buf.length &&
      buf[i] <= 2 &&
      buf[i + 1] === 0 &&
      buf[i + 2] === 0 &&
      buf[i + 3] === 0
    ) {
      const len = buf.readUInt32BE(i + 4);
      parts.push(buf.slice(i + 8, i + 8 + len).toString("utf8"));
      i += 8 + len;
    } else {
      // Not multiplexed (TTY mode); just dump what's left.
      parts.push(buf.slice(i).toString("utf8"));
      break;
    }
  }
  return parts.join("");
}
