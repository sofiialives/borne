import { Server as ServeurSocketIO } from "socket.io";
import type { Server } from "node:http";
import type { MessageWs } from "@borne/shared";

let io: ServeurSocketIO | null = null;

export function demarrerServeurWs(serveurHttp: Server): void {
  io = new ServeurSocketIO(serveurHttp, {
    path: "/ws",
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    socket.emit("evenement", {
      type: "CONNEXION_ETABLIE",
      donnees: null,
      horodatage: new Date().toISOString(),
    });
  });
}

export function diffuser(message: MessageWs): void {
  if (!io) return;
  io.emit("evenement", message);
}
