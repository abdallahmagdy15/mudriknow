

<div align="center">

<img src="assets/hero-mascot.png" alt="MudrikNow owl mascot" width="180" />

# MudrikNow  ·  <span dir="rtl">مدرك</span>

***Deja de explicar tu pantalla a la IA.*** **MudrikNow es un agente de IA de escritorio de código abierto que ve lo que tú ves — y responde, actúa o te guía paso a paso en cualquier tarea.**

[![License](https://img.shields.io/badge/license-MIT-18BFE1?style=flat-square)](LICENSE)
[![Release](https://img.shields.io/github/v/release/abdallahmagdy15/mudriknow?style=flat-square\&color=F2A93A\&include_prereleases)](https://github.com/abdallahmagdy15/mudriknow/releases)
[![Preview](https://img.shields.io/badge/status-preview-F2A93A?style=flat-square)](CHANGELOG.md)
[![Website](https://img.shields.io/badge/website-mudriknow-7499C2?style=flat-square)](https://abdallahmagdy15.github.io/mudriknow/)

[Sitio web](https://abdallahmagdy15.github.io/mudriknow/) · [Instalación](#-install) · [Atajos de teclado](#%EF%B8%8F-hotkeys) · [Acerca de](#-about)

</div>

***

## 🎬 Demo

[**Ver la demostración →**](https://abdallahmagdy15.github.io/mudriknow/)

<div align="center"><em>Alt+Space → preguntar → MudrikNow actúa en tu escritorio</em></div>

***

## ✨ Qué hace

Presiona **Alt+Space** sobre cualquier ventana. MudrikNow escanea la interfaz de tu ventana activa — cada botón, campo, etiqueta y valor — y abre un panel flotante en el lado opuesto de tu pantalla para que nada quede oculto. El elemento en el que apuntas se convierte en el punto de referencia. MudrikNow también captura una captura de pantalla completa con cuadrícula de coordenadas en cada activación, para que vea los píxeles además del árbol de interfaz.

A partir de ahí: pregunta, traduce, corrige o resume. O dale la orden de **actuar**: escribir, pegar, hacer clic, invocar o presionar atajos de teclado. Activa **Auto-Guide** y MudrikNow se convierte en un instructor — aparece un cursor con forma de búho en la pantalla que te guía paso a paso en cualquier tarea compleja.

## 🚀 Instalación

1. Instala **[Node.js ≥ 20](https://nodejs.org/)**.
2. Instala OpenCode (autenticación opcional — las claves pueden almacenarse dentro de la app):
   ```bash
   npm i -g opencode-ai
   ```
3. Descarga el último archivo `.exe` desde [Lanzamientos](https://github.com/abdallahmagdy15/mudriknow/releases) y ejecútalo.
4. **Conecta tu modelo de IA.** En el primer inicio, MudrikNow abre la configuración y resalta **Add a model** para ti. Elige un proveedor — **NVIDIA** es recomendado (capa gratuita generosa; [build.nvidia.com](https://build.nvidia.com/) → claves API) — pega tu clave, haz clic en **Verify** y luego selecciona un modelo. En cualquier momento: **⚙ → Model → Add a model**.

> El instalador está **sin firmar** — SmartScreen mostrará una advertencia en el primer inicio. *Más información → Ejecutar de todos modos*.

**Desde el código fuente:** `git clone https://github.com/abdallahmagdy15/mudriknow && cd mudriknow && npm install && npm start`

> **Prerrequisito de compilación para Windows:** `npm install` requiere Visual Studio con la carga de trabajo **"Desktop development with C++"** (para la compilación nativa de `robotjs` y `koffi`). Se recomienda Node.js ≥ 20 LTS. Consulta [`AGENTS.md`](AGENTS.md) para obtener todos los detalles.

## ⌨️ Atajos de teclado

Dos atajos globales ponen a MudrikNow frente a ti. Ambos se pueden reasignar desde el menú ⚙.

| Atajo        | Qué ocurre |
| ------------ | ------------ |
| `Alt+Space`  | Lee la interfaz completa de tu ventana activa y se ancla en lo que estás señalando. MudrikNow se abre en el lado opuesto de la pantalla, listo para ayudar. |
| `Alt+X`      | Chat rápido — abre el panel al instante sin capturar el contexto. Para preguntas que no requieren conciencia de la pantalla. |
| `Esc`        | Cancelar: detiene la transmisión o cierra el panel. |
| `Enter`      | Enviar el mensaje. `Shift+Enter` para nueva línea. |

## 🛠 Características

| <br />                       | <br />                                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🪟 **Lee cualquier app de Windows** | Usa Windows UI Automation para detectar botones, campos, texto y menús. Funciona en navegadores, Office, IDEs y diálogos nativos — en cualquier lugar donde llegue la accesibilidad. Captura una captura de pantalla en cada Alt+Space; el botón Capturar Contexto también está disponible.           |
| ⚡ **Actúa por ti**           | Escribe, pega, haz clic, invoca o presiona atajos de teclado — MudrikNow puede interactuar con cualquier elemento accesible.                                                                                                        |
| 🦉 **Auto-Guide**             | MudrikNow se convierte en un instructor: aparece un cursor con forma de búho en la pantalla, señala cada objetivo con un globo de diálogo y te guía paso a paso en tareas de interfaz complejas. Se activa/desactiva en la configuración ⚙.                            |
| 💬 **Modo de chat rápido**        | `Alt+X` abre el panel sin capturar el contexto — para preguntas que no requieren conciencia de la pantalla. MudrikNow está siempre a una tecla de distancia, incluso cuando solo necesitas una respuesta rápida.                                |
| 🔌 **Cualquier LLM**               | Más de 140 proveedores mediante [OpenCode](https://opencode.ai) + [models.dev](https://models.dev) — NVIDIA, Anthropic, OpenAI, Google, DeepSeek, OpenRouter y más. Elige un proveedor, pega tu clave y **Verifica** que funcione antes de confiar en él.                           |
| 🔒 **Aislado (Sandbox)**             | Shell de solo lectura para diagnósticos — escrituras, eliminaciones y piping están bloqueados (las violaciones detienen la sesión). Sin escritura en el sistema de archivos. La IA lee archivos en tu directorio de trabajo y ejecuta un conjunto permitido de acciones de UI. Eso es todo el alcance de sus capacidades.                                   |

## 🧠 Cómo funciona

```
Alt+Space (cursor)
  ↓  el atajo lee la posición del cursor
  ↓  script UIA de PowerShell — árbol JSON de la ventana activa
  ↓  captura de pantalla completa + cuadrícula de coordenadas, siempre
  ↓  MudrikNow se abre en el lado opuesto de la pantalla, listo para chatear

Alt+X (chat rápido)
  ↓  el panel se abre al instante — sin captura de contexto
  ↓  para preguntas que no requieren conciencia de la pantalla

Enviar mensaje
  ↓  transmisión a `opencode run --agent readonly`
  ↓  los tokens se renderizan en vivo; se analizan las marcas <!--ACTION:{...}-->
  ↓  las acciones se ejecutan mediante UIA o robotjs

Modo Auto-Guide (opcional mediante ⚙)
  ↓  la IA emite guide_offer → el usuario acepta
  ↓  aparece el cursor de búho con globo de diálogo, el panel se oculta
  ↓  el búho señala → el usuario hace clic → la IA avanza
  ↓  guide_complete → "¡Listo!" → regresa el panel
```

Arquitectura completa en **[AGENTS.md](AGENTS.md)**.

## 🔒 Privacidad y Seguridad

MudrikNow ejecuta la IA en un entorno aislado (sandbox) con capacidades deliberadamente limitadas:

| Capacidad                                        | ¿Expuesta al modelo?              |
| ------------------------------------------------- | ---------------------------------- |
| Ejecución de Shell / PowerShell                           | 🟡 Solo lectura (mutación/tuberías bloqueadas) |
| Escritura en **sistema de archivos**                              | ❌ No                              |
| **Lectura** de sistema de archivos (`read`/`grep`/`glob`/`list`) | ✅ Sí (dentro del directorio de trabajo)  |
| Windows UI Automation                             | ✅ Sí (conjunto de acciones predefinido)    |
| Teclado / ratón                                  | ✅ Sí (cuando UIA no puede alcanzar un objetivo) |
| Píxeles de pantalla                                     | ✅ Automático en cada Alt+Space |

Modelo de amenazas completo + reporte en **[SECURITY.md](SECURITY.md)**.

## 👋 Acerca de

Hola, soy **Abdullah Magdy**.

Un desarrollador senior que se cansó de explicar su pantalla a la IA — así que construí MudrikNow en mis noches y fines de semana. Código abierto para que puedas ver (y mejorar) cada línea.

- 🐙 GitHub — [@abdallahmagdy15](https://github.com/abdallahmagdy15)
- 🐦 X / Twitter — [@AbdallahMagdyy](https://x.com/AbdallahMagdyy)
- 💼 LinkedIn — [abdallahmagdy15](https://www.linkedin.com/in/abdallahmagdy15/)
- ✉️ `abdallah.magdy1515@gmail.com`

Para problemas de seguridad, usa **[Reporte privado de vulnerabilidades de GitHub](https://github.com/abdallahmagdy15/mudriknow/security/advisories/new)** (o el correo electrónico como respaldo) — no issues públicos.

## 🤝 Contribuir

PRs bienvenidos. MudrikNow está hecho en TypeScript de extremo a extremo (main, preload, renderer, tipos compartidos) — la única fuente de verdad para canales IPC, tipos de acción y forma de la configuración se encuentra en [`src/shared/types.ts`](src/shared/types.ts).&#x20;

Configuración, pipeline de compilación y flujo de lanzamiento en **[CONTRIBUTING.md](CONTRIBUTING.md)**. Código de conducta en **[CODE\_OF\_CONDUCT.md](CODE_OF_CONDUCT.md)**.

## 🙏 Agradecimientos

- **[OpenCode](https://opencode.ai)** — se encarga de la transmisión, proveedores y autenticación para que MudrikNow no tenga que hacerlo.
- **[Electron](https://electronjs.org)** · **[React](https://react.dev)** · **[robotjs](https://github.com/octalmage/robotjs)** · **Windows UI Automation**.

## 📄 Licencia

[MIT](LICENSE) — bifúrcalo, modifícalo, distribúyelo, véndelo. Solo mantén el aviso de copyright en el archivo LICENSE.

***

<div align="center"><sub>MudrikNow · <span dir="rtl">مدرك</span> · el consciente</sub></div>
