# Antel Voley

Planificador permanente para encontrar el día y horario con mayor disponibilidad dentro de un grupo. La interfaz se publica en GitHub Pages y los cambios se sincronizan en tiempo real mediante Firebase Realtime Database.

## Funcionalidades

- Una única planificación que no vence ni cambia automáticamente de semana.
- Grilla de días y horarios compartida en tiempo real.
- Solo permite marcar después de elegir un participante.
- Resultados conjuntos siempre visibles y mejor coincidencia resaltada.
- Barra móvil con acceso directo a los siete días.
- Dashboard para agregar y quitar participantes y horarios.
- Quitar elementos solo los desactiva: la disponibilidad ya cargada no se borra.
- Sin servidor propio, dependencias instaladas ni proceso de compilación.

## Configuración inicial

`js/config.js` contiene:

- `PARTICIPANTES` y `HORAS`: valores usados para crear la configuración compartida la primera vez.
- `DIAS`: días visibles en la planificación.
- `FIREBASE_CONFIG`: conexión con Firebase.
- `ID_GRUPO`: ruta que separa los datos de este grupo.

Después de la primera conexión, participantes y horarios se administran desde el dashboard de la web. No hace falta volver a editar el archivo para esos cambios.

## Crear el proyecto Firebase gratuito

1. Entrar a <https://console.firebase.google.com/> y crear un proyecto.
2. No es necesario habilitar Google Analytics.
3. Pulsar el icono Web `</>` y registrar una aplicación. No habilitar Firebase Hosting.
4. Ir a `Build > Realtime Database`, pulsar `Create database`, elegir una región y crearla en modo bloqueado.
5. Volver a `Project settings > General`, abrir la aplicación Web y elegir `SDK setup and configuration > Config`.
6. Copiar el objeto `firebaseConfig` actualizado. Debe incluir `databaseURL`.
7. Pegar sus valores dentro de `FIREBASE_CONFIG` en `js/config.js`.

La configuración web de Firebase es pública por diseño. La protección real de los datos se realiza mediante las reglas.

## Publicar las reglas

En Firebase, abrir `Realtime Database > Rules`, copiar todo el contenido de `firebase.rules.json` y pulsar **Publish**.

Las reglas permiten que el grupo de confianza lea la planificación, marque disponibilidad y use el dashboard. Validan la estructura de participantes, horas y votos. Cualquier persona que conozca la aplicación puede administrar el grupo, por lo que no debe utilizarse para información sensible.

Si se cambia `ID_GRUPO` en `js/config.js`, también se debe cambiar la clave `antel-voley` dentro de `firebase.rules.json`.

## Conservación y migración de datos

Los participantes y horarios tienen un campo `activo`. Al quitarlos desde el dashboard pasan a `false`, pero sus votos permanecen en Firebase. Si se agrega nuevamente el mismo nombre u horario, se reactiva el identificador anterior y reaparecen sus datos.

Al ejecutar esta versión por primera vez, si la planificación permanente está vacía, la aplicación copia automáticamente la disponibilidad de la semana actual usada por la versión anterior. No elimina la información histórica de `semanas/`.

## Ejecución local

Como el proyecto utiliza módulos JavaScript, se debe servir la carpeta con un servidor estático, por ejemplo la extensión Live Server de VS Code. La versión publicada en GitHub Pages funciona directamente.

## Publicación en GitHub Pages

1. Subir todos los archivos al repositorio.
2. Entrar a `Settings > Pages`.
3. En `Build and deployment`, seleccionar `Deploy from a branch`.
4. Elegir la rama principal y la carpeta `/ (root)`.
5. Guardar y abrir la URL generada.

## Estructura de datos

```text
grupos/
  antel-voley/
    configuracion/
      participantes/
      horas/
    disponibilidades/
      rodrigo/
        lunes-19-00: true
```

Los totales se calculan en el navegador. La configuración y la disponibilidad se actualizan para todos los dispositivos mediante listeners de Firebase.
