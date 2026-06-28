# Setup: Automatic Issue Analyzer with Claude

Este documento explica cómo activar el analizador automático de issues que usa Claude para asignar labels y generar diagnósticos técnicos.

---

## ¿Qué es?

Un **GitHub Action workflow** que corre automáticamente cada vez que:
- Se abre un nuevo issue
- Se edita un issue existente

El workflow:
1. Envía el título y cuerpo del issue a Claude
2. Claude elige labels apropiados y ejecuta comandos via `gh CLI`
3. Claude postea un comentario con diagnóstico técnico detallado

---

## Setup (pasos de una sola vez)

### 1. Crear los labels en el repositorio

Los labels están definidos en `.github/labels.yml`. Necesitás crearlos en GitHub una sola vez.

**Opción A: Vía línea de comandos (si tenés `gh` instalado)**

```bash
cd /home/ingcruz/ClaudeCode/03-tetris-w-claude

gh label create bug --color d73a4a --description "Algo no funciona como debería"
gh label create enhancement --color a2eeef --description "Nueva funcionalidad o mejora"
gh label create game-mechanics --color 7057ff --description "Lógica central del juego"
gh label create ui/ux --color e4e669 --description "Interfaz visual o experiencia"
gh label create controls --color 0075ca --description "Controles de teclado"
gh label create scoring --color cfd3d7 --description "Sistema de puntuación, líneas y niveles"
gh label create performance --color e99695 --description "Velocidad, FPS, optimizaciones"
gh label create question --color d876e3 --description "Pregunta general"
gh label create duplicate --color cfd3d7 --description "Ya existe un issue similar"
```

**Opción B: Vía GitHub UI (web)**

1. Andá a tu repositorio en GitHub
2. Settings → Labels
3. Creá manualmente cada label con los colores y descripciones de `.github/labels.yml`

### 2. Verificar que el secret exista

El workflow usa `CLAUDE_CODE_OAUTH_TOKEN` que ya debe estar configurado (si otros workflows en `.github/workflows/` usan ese secret).

Para verificar:
1. Andá a Settings → Secrets and variables → Actions
2. Confirma que `CLAUDE_CODE_OAUTH_TOKEN` esté presente

Si no está, necesitás crear un token de GitHub Personal con permisos `repo` y `workflow`, y agregarlo como secret.

### 3. Ya está

No hay más configuración. El workflow corre automáticamente en el próximo issue.

---

## Uso

Simplemente creá o editá un issue:

```bash
gh issue create --title "Bug: Piece rotation fails at wall" --body "Cuando rotas una pieza contra la pared derecha, a veces no rota..."
```

O directamente en GitHub.com → Issues → New issue

En 1-2 minutos:
- El workflow corre
- Claude asigna labels
- Claude postea un comentario con diagnóstico

---

## Cómo ver el resultado

1. **Labels en el issue**: lado derecho del issue, verás los labels asignados
2. **Comentario de Claude**: scroll down en el issue, verás un comentario con:
   - Labels asignados
   - Descripción del problema
   - Áreas de código afectadas
   - Enfoque sugerido para resolver

3. **Log del workflow**: si algo falla, andá a Actions → Issue Analyzer para ver el log

---

## Customización

### Cambiar labels disponibles

Editá `.github/labels.yml` y `.github/workflows/issue-analyzer.yml` (en la sección `prompt`).

### Cambiar el prompt de Claude

Editá `.github/workflows/issue-analyzer.yml`, sección `prompt:` del step `Analyze issue with Claude`.

### Deshabilitar el workflow

Renombrá `.github/workflows/issue-analyzer.yml` a `issue-analyzer.yml.disabled` o borralo.

---

## Troubleshooting

### El workflow no corre
- Verificá que el secret `CLAUDE_CODE_OAUTH_TOKEN` exista en Settings → Secrets
- Verificá en Actions → Issue Analyzer → [latest run] para ver si hay errores

### No se asignan labels
- Asegurate que los labels estén creados en GitHub (Settings → Labels)
- Los nombres en `gh issue edit` deben coincidir exactamente con los nombres en GitHub

### Claude no postea comentario
- Puede ser un timeout de la API. Reintentá editando el issue (que dispara el workflow de nuevo)
- Verificá el log en Actions para más detalles

---

## Estructura de archivos

```
.github/
  labels.yml                    ← Definición de labels
  workflows/
    issue-analyzer.yml          ← Nuevo workflow
    claude.yml                  ← Existente (no tocar)
    claude-code-review.yml      ← Existente (no tocar)
```

---

## Notas

- El workflow corre en paralelo a los otros workflows, no interfiere con ellos
- Cada edición de un issue dispara el workflow de nuevo (comportamiento esperado)
- El costo de llamadas a la API es minimal — solo se llama al crear o editar un issue
