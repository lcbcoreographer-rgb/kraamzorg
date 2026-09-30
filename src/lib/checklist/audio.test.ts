import { describe, expect, it } from "vitest";
import {
  caminhoDoAudio,
  conferirAudio,
  extensaoDoTipo,
  tipoBase,
} from "./audio";

const LIMITES = {
  duracaoMaxSeg: 600,
  tamanhoMaxBytes: 1000,
  tipos: ["audio/webm", "audio/mpeg"],
};

describe("áudio da visita", () => {
  it("o caminho leva só o id da visita e o do arquivo, nunca nome de paciente", () => {
    const caminho = caminhoDoAudio(
      "f2300000-0000-4000-8000-000000000003",
      "a1b2c3d4-0000-4000-8000-000000000001",
      "webm",
    );
    expect(caminho).toBe(
      "visitas/f2300000-0000-4000-8000-000000000003/a1b2c3d4-0000-4000-8000-000000000001.webm",
    );
    expect(caminho).toMatch(
      /^visitas\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/,
    );
  });

  it("tira o codec do tipo e acha a extensão", () => {
    expect(tipoBase("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(extensaoDoTipo("audio/webm;codecs=opus")).toBe("webm");
    expect(extensaoDoTipo("audio/mp4")).toBe("m4a");
    expect(extensaoDoTipo("video/mp4")).toBeNull();
  });

  it("confere tipo, tamanho e duração contra o parâmetro", () => {
    expect(
      conferirAudio(LIMITES, {
        tipo: "audio/webm;codecs=opus",
        tamanhoBytes: 500,
        duracaoSeg: 30,
      }),
    ).toBeNull();
    expect(
      conferirAudio(LIMITES, {
        tipo: "video/mp4",
        tamanhoBytes: 500,
        duracaoSeg: 30,
      }),
    ).toBe("tipo");
    expect(
      conferirAudio(LIMITES, {
        tipo: "audio/webm",
        tamanhoBytes: 1001,
        duracaoSeg: 30,
      }),
    ).toBe("tamanho");
    expect(
      conferirAudio(LIMITES, {
        tipo: "audio/webm",
        tamanhoBytes: 10,
        duracaoSeg: 601,
      }),
    ).toBe("duracao");
    expect(
      conferirAudio(LIMITES, {
        tipo: "audio/webm",
        tamanhoBytes: 10,
        duracaoSeg: null,
      }),
    ).toBeNull();
  });
});
