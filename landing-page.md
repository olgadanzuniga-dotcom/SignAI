# SignAI — La app que rompe la barrera de la comunicación con la Lengua de Señas Mexicana

## Tu cámara web. Tu voz. La inteligencia artificial.

**SignAI** es una aplicación de escritorio con inteligencia artificial que traduce la **Lengua de Señas Mexicana (LSM)** en tiempo real. Solo necesitas tu cámara web: haz una seña frente a ella y SignAI la reconoce al instante y la pronuncia por voz.

Sin equipo especial. Sin instalaciones complicadas. Sin aprender a programar.

---

## ¿Qué es SignAI?

SignAI es mucho más que un traductor. Es una plataforma completa de **aprendizaje, práctica y traducción de LSM** impulsada por modelos de inteligencia artificial de última generación.

Imagina poder comunicarte con personas sordas sin conocer una sola seña. Imagina que un niño con discapacidad auditiva pueda practicar LSM con juegos interactivos mientras sus compañeros juegan también. Imagina que tu empresa, escuela u organización pueda ofrecer inclusión real con herramientas accesibles.

**Eso es SignAI.**

Nuestra aplicación combina dos mundos en una sola experiencia:

1. **Traductor LSM en vivo** — Conversión automática de señas a voz usando visión por computadora y modelos Transformer.
2. **App de aprendizaje completa** — Lecciones estructuradas por categorías + 4 juegos interactivos para practicar mientras te diviertes.

Todo esto corre en tu computadora, con tu cámara, con tu privacidad protegida.

---

## ¿Cómo funciona?

SignAI utiliza un sistema de **inteligencia artificial de doble modelo** que detecta, analiza y traduce las señas con precisión:

- **Detección de manos con MediaPipe Hands**: tecnología de Google que identifica 21 puntos clave de la mano en tiempo real.
- **Dos modelos Transformer especializados**:
  - **Modelo estático** (21 letras del abecedario LSM): reconoce señas que no requieren movimiento.
  - **Modelo dinámico** (9 señas con movimiento): reconoce señas que involucran trayectoria y gesto, como AGUA, HOLA, PERRO.
- **Servidor de inferencia local (Python + FastAPI)**: procesa cada frame sin enviar datos a la nube.
- **Síntesis de voz integrada**: usa ElevenLabs para voz natural en la nube o Web Speech API para uso completamente offline.

**¿El resultado?** Latencia baja, respuesta inmediata, traducción fluida.

---

## Características principales

### 🎯 Traductor LSM en vivo
- Reconocimiento en tiempo real desde tu cámara web.
- Salida de voz automática cuando se detecta una seña.
- Cambio entre modo estático (letras) y dinámico (palabras) según lo que necesites.
- Funciona 100% local: tu cámara y tus señas no salen de tu computadora.

### 📚 Aprende LSM desde cero
9 módulos de aprendizaje organizados por categorías temáticas:

1. **Abecedario** — Las 21 letras del LSM reconocidas por SignAI.
2. **Números** — Aprende a contar y representar cantidades.
3. **Colores** — Comunicación visual básica.
4. **Presentaciones** — Cómo decir tu nombre y presentarte.
5. **Saludos** — Las formas esenciales de cortesía.
6. **Días** — Vocabulario temporal.
7. **Comida** — Palabras relacionadas con alimentación.
8. **Lugares** — Ubicaciones y direcciones.
9. **Transporte** — Medios de movilidad y vehículos.

Cada módulo está diseñado para que avances a tu propio ritmo con validación real por cámara.

### 🎮 4 juegos interactivos

Aprender LSM no tiene por qué ser aburrido. SignAI incluye cuatro juegos diseñados para reforzar lo aprendido de forma divertida:

- **Memorama** — Encuentra las parejas de señas y letras.
- **Quiz Visual** — Pon a prueba tu conocimiento reconociendo señas.
- **Modo Desafío** — Completa retos contra el reloj.
- **Deletreo** — Practica deletreando palabras completas.

Perfectos para niños, familias, aulas y cualquier persona que quiera aprender jugando.

### 🔒 Privacidad y control total
- **Procesamiento local**: la inteligencia artificial corre en tu equipo, no en servidores externos.
- **Sin rastreo**: no enviamos tus señas ni imágenes a la nube (excepto cuando usas ElevenLabs para síntesis de voz premium).
- **Tu cámara, tus datos**: tú decides cuándo se activa.

---

## ¿Por qué elegir SignAI?

### Inclusión real, no promesas vacías
En México, más de **2.3 millones de personas** tienen discapacidad auditiva. La LSM es su lengua natural, pero la mayoría de la población oyente no la conoce. SignAI existe para cerrar esa brecha.

### Tecnología de punta al servicio de las personas
No usamos reconocimiento básico de imágenes. Usamos **Transformers**, la misma arquitectura detrás de los modelos de lenguaje más avanzados del mundo, entrenados específicamente para LSM.

### Diseñado para todos
- **Personas oyentes** que quieren aprender LSM.
- **Familias** con miembros sordos que quieren comunicarse mejor.
- **Estudiantes** que necesitan herramientas de apoyo.
- **Empresas** comprometidas con la inclusión laboral.
- **Escuelas** que ofrecen educación bilingüe.
- **Organizaciones** que atienden a comunidades sordas.

### Funciona desde el primer minuto
A diferencia de otras soluciones que requieren hardware especializado (guantes, sensores, cámaras 3D), SignAI usa **tu cámara web обычная**. La que ya tienes.

### Aprendizaje integral
No solo es un traductor: es una plataforma educativa completa. Aprendes, practicas, juegas y conversas, todo en un mismo lugar.

---

## Planes y precios

SignAI ofrece un modelo **freemium** diseñado para que puedas empezar gratis y escalar según tus necesidades.

### 🆓 Plan Gratuito
**$0 MXN/mes**

Perfecto para:
- Conocer SignAI y explorar sus capacidades.
- Aprender lo básico del abecedario LSM.
- Probar los juegos interactivos.
- Familias que quieren empezar sin compromiso.

### ⭐ Plan Premium B2C (Personas)
**$149 MXN/mes**

Ideal para:
- Personas que quieren acceso completo a todas las funciones.
- Estudiantes que necesitan práctica intensiva.
- Familias que buscan herramientas de comunicación diaria.
- Usuarios que quieren voz natural de alta calidad con ElevenLabs.

**Incluye:**
- Acceso ilimitado al traductor en vivo.
- Todos los 9 módulos de aprendizaje.
- Los 4 juegos interactivos sin restricciones.
- Síntesis de voz premium (ElevenLabs).
- Actualizaciones prioritarias.

### 🏢 Plan Premium B2B (Organizaciones)
**$200,000 MXN/año**

Diseñado para:
- Escuelas y universidades.
- Empresas comprometidas con la inclusión.
- Organizaciones civiles y gubernamentales.
- Centros de atención a personas sordas.

**Incluye:**
- Licencia para múltiples usuarios.
- Instalación y configuración personalizada.
- Soporte técnico dedicado.
- Capacitación para equipos.
- Reportes de uso y métricas.
- Personalización para tu organización.

---

## La tecnología detrás de SignAI

### Arquitectura de doble modelo

SignAI utiliza **dos modelos Transformer** con la misma arquitectura base (`SignTransformer`), cada uno especializado en un tipo de señas:

#### Modelo Estático (21 clases)
Reconoce letras del abecedario LSM que se representan con una posición fija de la mano:
A, B, C, D, E, F, G, H, I, L, M, N, O, P, R, S, T, U, V, W, Y

#### Modelo Dinámico (9 clases)
Reconoce señas que requieren movimiento:
**AGUA**, **HOLA**, **J**, **PERRO**, **Q**, **RR**, **X**, **Z**, **Ñ**

### Pipeline de procesamiento

```
Cámara web
   ↓
MediaPipe Hands (detección de 21 puntos clave)
   ↓
Normalización de features
   ↓
Transformer (estático o dinámico)
   ↓
Predicción + confianza
   ↓
Síntesis de voz (ElevenLabs o Web Speech)
```

Todo esto ocurre en milisegundos, permitiendo una experiencia conversacional natural.

---

## Casos de uso

### 🏠 En casa
Una familia con un hijo sordo quiere comunicarse mejor. Con SignAI, los hermanos oyentes pueden aprender LSM jugando, y los padres pueden practicar antes de dormir.

### 🏫 En la escuela
Un profesor de educación especial necesita herramientas para enseñar LSM a estudiantes oyentes que quieren aprender. SignAI ofrece práctica interactiva con validación automática.

### 🏢 En la empresa
Una empresa quiere ser más inclusiva. Con SignAI, los empleados pueden aprender vocabulario básico de LSM para atender mejor a clientes sordos.

### 🏥 En el sector salud
Personal médico que necesita comunicarse con pacientes sordos puede usar SignAI como apoyo durante consultas.

### 🛍️ En el comercio
Vendedores y cajeros que quieren ofrecer atención incluyente pueden aprender señas clave con SignAI.

---

## Tu privacidad es prioridad

En SignAI creemos que la tecnología debe respetar tu privacidad:

- ✅ **Procesamiento local**: los modelos de IA corren en tu computadora, no en la nube.
- ✅ **Sin envío de imágenes**: tus señas no se transmiten a servidores externos.
- ✅ **Control total**: tú decides cuándo se activa la cámara.
- ✅ **Síntesis de voz opcional**: puedes usar Web Speech (local) o ElevenLabs (nube) según tu preferencia.

---

## El futuro de SignAI

SignAI está en constante evolución. Nuestro roadmap incluye:

- **Unificación de traducción estática + dinámica** para conversaciones más naturales.
- **Capa de NLP** para que SignAI entienda frases completas, no solo señas aisladas.
- **Modelo 3D de mano** para aprendizaje visual avanzado.
- **Modo Kids** especializado para niños.
- **Rediseño de interfaz** para una experiencia aún más intuitiva.

Tu suscripción premium ayuda a hacer posible este futuro.

---

## ¿Listo para romper la barrera de la comunicación?

Millones de personas en México usan LSM como su lengua materna. Millones más quieren aprenderla pero no saben por dónde empezar.

**SignAI es ese puente.**

Ya sea que quieras aprender una sola seña para comunicarte con alguien especial, o que necesites una plataforma completa para tu organización, SignAI tiene un plan para ti.

---

### Empieza hoy

**Prueba SignAI gratis** — Sin tarjeta de crédito, sin compromisos.

**Suscríbete a Premium** — Acceso completo por solo $149 MXN/mes.

**Licencia empresarial** — Incluye a toda tu organización por $200,000 MXN/año.

---

## Preguntas frecuentes

### ¿Necesito una cámara especial?
No. SignAI funciona con cualquier cámara web estándar, incluyendo la de tu laptop.

### ¿Necesito internet?
Solo si usas síntesis de voz con ElevenLabs. Con Web Speech API, SignAI funciona completamente offline.

### ¿Cuántas señas reconoce SignAI hoy?
- **21 letras estáticas** del abecedario LSM.
- **9 señas dinámicas** (AGUA, HOLA, J, PERRO, Q, RR, X, Z, Ñ).
- Total: **30 señas funcionales** con IA.

### ¿Funciona en Windows, Mac y Linux?
SignAI es una app de escritorio multiplataforma (Electron).

### ¿Es difícil de instalar?
No. SignAI se instala como cualquier aplicación y configura el servidor de IA automáticamente.

---

## Únete a la revolución de la inclusión

**SignAI** no es solo una app. Es un movimiento hacia una sociedad donde la comunicación no tiene barreras.

**Descarga SignAI hoy** y descubre cómo la inteligencia artificial puede cambiar vidas.

---

*SignAI — Comunicación sin barreras.*