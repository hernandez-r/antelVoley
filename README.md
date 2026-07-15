# Antel Voley

Planificador semanal estático para encontrar el horario con mayor disponibilidad dentro de un grupo. La interfaz se publica en GitHub Pages y los cambios se sincronizan en tiempo real mediante Firebase Realtime Database.

## Funcionalidades

- Grilla semanal configurable por días y horarios.
- Desplegable cerrado de participantes.
- Solo permite marcar después de elegir un nombre.
- Resultados conjuntos visibles en todo momento.
- Vista móvil de un día por vez, sin desplazamiento horizontal.
- Resalta automáticamente los horarios con mayor coincidencia.
- Navegación entre semanas.
- Actualización en vivo para todos los dispositivos conectados.
- Sin servidor propio, dependencias instaladas ni proceso de compilación.

## Configuración rápida

### 1. Personalizar el grupo

Editar `js/config.js`:

- `PARTICIPANTES`: reemplazar los nombres de ejemplo por los reales. Cada `id` debe ser único, sin espacios ni tildes.
- `DIAS`: quitar los días que no se utilicen si corresponde.
- `HORAS`: definir los horarios posibles.

### 2. Crear el proyecto Firebase gratuito

1. Entrar a <https://console.firebase.google.com/> y crear un proyecto.
2. No es necesario habilitar Google Analytics.
3. Dentro del proyecto, pulsar el icono Web `</>` y registrar una aplicación. No habilitar Firebase Hosting.
4. Ir a `Build > Realtime Database`, pulsar `Create database`, elegir una región y crearla en modo bloqueado.
5. Volver a `Project settings > General`, abrir la aplicación Web y elegir `SDK setup and configuration > Config`.
6. Copiar el objeto `firebaseConfig` actualizado. Es importante que incluya `databaseURL`.
7. Pegar sus valores dentro de `FIREBASE_CONFIG` en `js/config.js`.

La configuración web de Firebase queda visible en el navegador por diseño. La protección real de los datos se hace con las reglas de la base.

### 3. Instalar las reglas

En Firebase, abrir `Realtime Database > Rules`, copiar el contenido de `firebase.rules.json` y pulsar **Publish**.

Las reglas incluidas permiten lectura pública y escritura de valores booleanos únicamente dentro del grupo `antel-voley`. Es una configuración deliberadamente simple para un grupo de confianza. Cualquier persona que conozca la aplicación podría seleccionar otro nombre, por lo que no debe utilizarse para información sensible.

Si se cambia `ID_GRUPO` en `js/config.js`, se debe cambiar también la clave `antel-voley` dentro de `firebase.rules.json`.

## Ejecución local

Como el proyecto ahora utiliza módulos JavaScript, conviene servir la carpeta con un servidor estático en vez de abrir `index.html` mediante `file://`. Por ejemplo, con la extensión Live Server de VS Code.

La versión publicada en GitHub Pages funciona directamente.

## Publicación en GitHub Pages

1. Subir los archivos al repositorio.
2. Entrar a `Settings > Pages`.
3. En `Build and deployment`, seleccionar `Deploy from a branch`.
4. Elegir la rama principal y la carpeta `/ (root)`.
5. Guardar y abrir la URL generada.

Los archivos usan rutas relativas, por lo que funcionan aunque el sitio esté publicado bajo una ruta como `usuario.github.io/antelVoley/`.

## Estructura de datos

```text
grupos/
  antel-voley/
    semanas/
      2026-07-20/
        disponibilidades/
          rodrigo/
            lunes-19-00: true
```

Cada semana se identifica por la fecha de su lunes. Los totales se calculan en el navegador a partir de las respuestas y no se guardan duplicados en la base.
