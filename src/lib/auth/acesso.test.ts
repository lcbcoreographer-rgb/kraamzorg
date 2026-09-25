import { describe, expect, it } from "vitest";
import { decidirAcesso, precisaMfa, proximoSeguro } from "./acesso";
import type { Papel } from "./papeis";
import type { SessaoBorda } from "./tipos";

function sessao(
  papeis: Papel[],
  extra: Partial<SessaoBorda> = {},
): SessaoBorda {
  return {
    usuarioId: "u1",
    papeis,
    ativo: true,
    aal: "aal2",
    aalPossivel: "aal2",
    ...extra,
  };
}

const seguir = { tipo: "seguir" };
const para = (destino: string) => ({ tipo: "redirecionar", para: destino });

describe("decidirAcesso: sem sessão", () => {
  it("manda para /entrar guardando o caminho pedido", () => {
    expect(decidirAcesso("/pipeline", null)).toEqual(
      para("/entrar?proximo=%2Fpipeline"),
    );
    expect(decidirAcesso("/familias/abc", null)).toEqual(
      para("/entrar?proximo=%2Ffamilias%2Fabc"),
    );
  });

  it("a raiz vai para /entrar sem ?proximo", () => {
    expect(decidirAcesso("/", null)).toEqual(para("/entrar"));
  });

  it("deixa abrir as telas públicas", () => {
    for (const caminho of [
      "/sair",
      "/entrar",
      "/esqueci-senha",
      "/auth/confirmar",
      "/design-system",
    ]) {
      expect(decidirAcesso(caminho, null)).toEqual(seguir);
    }
  });

  it("o caminho até o MFA também pede sessão", () => {
    expect(decidirAcesso("/mfa/desafio", null)).toEqual(
      para("/entrar?proximo=%2Fmfa%2Fdesafio"),
    );
    expect(decidirAcesso("/definir-senha", null)).toEqual(
      para("/entrar?proximo=%2Fdefinir-senha"),
    );
  });
});

describe("decidirAcesso: MFA (AAL2) para os papéis que exigem (PRD 13 e 21.2)", () => {
  it.each<Papel>(["enfermeira", "financeiro", "coordenacao", "diretoria"])(
    "%s em AAL1 com MFA cadastrado vai para o desafio",
    (papel) => {
      const s = sessao([papel], { aal: "aal1", aalPossivel: "aal2" });
      expect(decidirAcesso("/inicio", s)).toEqual(
        para("/mfa/desafio?proximo=%2Finicio"),
      );
      expect(decidirAcesso("/", s)).toEqual(para("/mfa/desafio"));
    },
  );

  it.each<Papel>(["enfermeira", "financeiro", "coordenacao", "diretoria"])(
    "%s em AAL1 sem MFA cadastrado vai para o cadastro",
    (papel) => {
      const s = sessao([papel], { aal: "aal1", aalPossivel: "aal1" });
      expect(decidirAcesso("/inicio", s)).toEqual(
        para("/mfa/cadastro?proximo=%2Finicio"),
      );
    },
  );

  it.each<Papel>(["comercial", "marketing"])(
    "%s trabalha em AAL1 sem MFA cadastrado",
    (papel) => {
      const s = sessao([papel], { aal: "aal1", aalPossivel: "aal1" });
      expect(decidirAcesso("/inicio", s)).toEqual(seguir);
    },
  );

  it("comercial sem MFA pode abrir o cadastro por vontade própria, mas não o desafio", () => {
    const s = sessao(["comercial"], { aal: "aal1", aalPossivel: "aal1" });
    expect(decidirAcesso("/mfa/cadastro", s)).toEqual(seguir);
    expect(decidirAcesso("/mfa/desafio", s)).toEqual(para("/inicio"));
    expect(decidirAcesso("/mfa/cadastro", sessao(["comercial"]))).toEqual(
      para("/inicio"),
    );
  });

  it("quem cadastrou o MFA sempre passa pelo desafio, mesmo o comercial", () => {
    const s = sessao(["comercial"], { aal: "aal1", aalPossivel: "aal2" });
    expect(decidirAcesso("/pipeline", s)).toEqual(
      para("/mfa/desafio?proximo=%2Fpipeline"),
    );
  });

  it("vale para a pessoa com vários papéis se um deles exige (Leonardo)", () => {
    const s = sessao(["diretoria", "comercial", "financeiro"], {
      aal: "aal1",
      aalPossivel: "aal1",
    });
    expect(decidirAcesso("/pipeline", s)).toEqual(
      para("/mfa/cadastro?proximo=%2Fpipeline"),
    );
  });

  it("em AAL1 deixa abrir o desafio, o cadastro, a senha e o sair", () => {
    const s = sessao(["diretoria"], { aal: "aal1", aalPossivel: "aal2" });
    expect(decidirAcesso("/mfa/desafio", s)).toEqual(seguir);
    expect(decidirAcesso("/sair", s)).toEqual(seguir);
    expect(decidirAcesso("/mfa/cadastro", s)).toEqual(para("/mfa/desafio"));
    const convidada = sessao(["diretoria"], {
      aal: "aal1",
      aalPossivel: "aal1",
    });
    expect(decidirAcesso("/definir-senha", convidada)).toEqual(seguir);
    expect(decidirAcesso("/mfa/cadastro", convidada)).toEqual(seguir);
  });

  it("quem já tem MFA passa pelo desafio antes de trocar a senha pelo link do e-mail", () => {
    const s = sessao(["diretoria"], { aal: "aal1", aalPossivel: "aal2" });
    expect(decidirAcesso("/definir-senha", s)).toEqual(
      para("/mfa/desafio?proximo=%2Fdefinir-senha"),
    );
    expect(decidirAcesso("/definir-senha", sessao(["diretoria"]))).toEqual(
      seguir,
    );
  });

  it("já em AAL2, o desafio volta para o início do papel", () => {
    expect(decidirAcesso("/mfa/desafio", sessao(["coordenacao"]))).toEqual(
      para("/inicio"),
    );
    expect(decidirAcesso("/mfa/cadastro", sessao(["enfermeira"]))).toEqual(
      para("/hoje"),
    );
  });

  it("quem já entrou e abre /entrar vai para o início ou para o MFA", () => {
    expect(decidirAcesso("/entrar", sessao(["comercial"]))).toEqual(
      para("/inicio"),
    );
    expect(
      decidirAcesso(
        "/entrar",
        sessao(["diretoria"], { aal: "aal1", aalPossivel: "aal2" }),
      ),
    ).toEqual(para("/mfa/desafio"));
  });
});

describe("decidirAcesso: cada papel na própria navegação", () => {
  it("a raiz vai para o início do papel", () => {
    expect(decidirAcesso("/", sessao(["comercial"]))).toEqual(para("/inicio"));
    expect(decidirAcesso("/", sessao(["enfermeira"]))).toEqual(para("/hoje"));
  });

  it("rota fora da navegação volta para o início", () => {
    expect(decidirAcesso("/sessoes", sessao(["comercial"]))).toEqual(
      para("/inicio"),
    );
    expect(decidirAcesso("/pipeline", sessao(["enfermeira"]))).toEqual(
      para("/hoje"),
    );
    expect(decidirAcesso("/hoje", sessao(["comercial"]))).toEqual(
      para("/inicio"),
    );
    expect(decidirAcesso("/configuracoes", sessao(["financeiro"]))).toEqual(
      para("/inicio"),
    );
    expect(decidirAcesso("/familias", sessao(["marketing"]))).toEqual(
      para("/inicio"),
    );
  });

  it("rota da navegação e subcaminho seguem", () => {
    expect(decidirAcesso("/pipeline", sessao(["comercial"]))).toEqual(seguir);
    expect(decidirAcesso("/familias/123", sessao(["coordenacao"]))).toEqual(
      seguir,
    );
    expect(decidirAcesso("/sessoes", sessao(["diretoria"]))).toEqual(seguir);
    expect(decidirAcesso("/configuracoes", sessao(["coordenacao"]))).toEqual(
      seguir,
    );
  });

  it("nega por padrão o que não está no registro da navegação", () => {
    const comercial = sessao(["comercial"]);
    // Letra codificada, maiúscula trocada e rota que nenhum papel registrou.
    expect(decidirAcesso("/%66inanceiro", comercial)).toEqual(para("/inicio"));
    expect(decidirAcesso("/Financeiro", comercial)).toEqual(para("/inicio"));
    expect(decidirAcesso("/qualquer-coisa", comercial)).toEqual(
      para("/inicio"),
    );
    expect(decidirAcesso("/api-falsa", sessao(["enfermeira"]))).toEqual(
      para("/hoje"),
    );
    // O que é público continua abrindo com sessão.
    expect(decidirAcesso("/design-system", comercial)).toEqual(seguir);
    expect(decidirAcesso("/sair", comercial)).toEqual(seguir);
  });

  it("convite de pessoa só para a diretoria", () => {
    expect(decidirAcesso("/convidar", sessao(["diretoria"]))).toEqual(seguir);
    expect(decidirAcesso("/convidar", sessao(["coordenacao"]))).toEqual(
      para("/inicio"),
    );
  });

  it("perfil sem papel ou desativado sai com aviso", () => {
    expect(decidirAcesso("/inicio", sessao([]))).toEqual(
      para("/sair?motivo=sem-acesso"),
    );
    expect(
      decidirAcesso("/inicio", sessao(["comercial"], { ativo: false })),
    ).toEqual(para("/sair?motivo=sem-acesso"));
  });
});

describe("precisaMfa e proximoSeguro", () => {
  it("precisaMfa devolve null em AAL2", () => {
    expect(precisaMfa(sessao(["diretoria"]))).toBeNull();
  });

  it("proximoSeguro só aceita caminho interno", () => {
    expect(proximoSeguro("/pipeline?x=1")).toBe("/pipeline?x=1");
    expect(proximoSeguro("https://exemplo.com")).toBeNull();
    expect(proximoSeguro("//exemplo.com")).toBeNull();
    expect(proximoSeguro("/\\exemplo.com")).toBeNull();
    expect(proximoSeguro(undefined)).toBeNull();
  });
});
