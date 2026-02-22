const API_BASE = "/api";

export async function createSession(lcId?: string, problemText?: string) {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lc_id: lcId || null, problem_text: problemText || null }),
  });
  return res.json();
}

export async function getSession(sessionId: string) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
  return res.json();
}

export async function postCheckpoint(data: {
  sessionId: string;
  sequenceNum: number;
  pseudocode: string;
  whiteboardJson: string;
  labels: string;
  audioBlob?: Blob;
}) {
  const form = new FormData();
  form.append("session_id", data.sessionId);
  form.append("sequence_num", String(data.sequenceNum));
  form.append("pseudocode", data.pseudocode);
  form.append("whiteboard_json", data.whiteboardJson);
  form.append("labels", data.labels);
  if (data.audioBlob) {
    form.append("audio_blob", data.audioBlob, "chunk.webm");
  }
  const res = await fetch(`${API_BASE}/checkpoints`, { method: "POST", body: form });
  return res.json();
}

export async function triggerCoach(data: {
  sessionId: string;
  triggerType: string;
  revealMode?: boolean;
  audioBlob?: Blob;
  whiteboardPng?: Blob;
}) {
  const form = new FormData();
  form.append("trigger_type", data.triggerType);
  form.append("reveal_mode", String(data.revealMode ?? false));
  if (data.audioBlob) {
    form.append("audio_blob", data.audioBlob, "audio.webm");
  }
  if (data.whiteboardPng) {
    form.append("whiteboard_png", data.whiteboardPng, "whiteboard.png");
  }
  const res = await fetch(`${API_BASE}/sessions/${data.sessionId}/coach`, {
    method: "POST",
    body: form,
  });
  return res.json();
}

export async function completeSession(sessionId: string) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/complete`, { method: "POST" });
  return res.json();
}

export async function getCard(sessionId: string) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/card`);
  return res.json();
}
