const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const { Readable } = require('stream');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Configuración de Google Drive con las credenciales seguras de Render
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive']
});
const drive = google.drive({ version: 'v3', auth });

const PARENT_FOLDER_ID = process.env.PARENT_FOLDER_ID; // El ID de tu Carpeta Madre principal
const YOUR_EMAIL = 'invitaendigitalweb@gmail.com'; // Tu correo personal

app.use(express.json());

app.post('/subir-recuerdo', upload.single('archivo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se subió ningún archivo' });
        }

        const nombreEvento = req.body.evento || 'PRUEBA MATEO';
        console.log(`Buscando o creando la carpeta para el evento: ${nombreEvento}`);

        // 1. Buscar si la carpeta del evento ya existe dentro de la Carpeta Madre
        const folderQuery = `mimeType='application/vnd.google-apps.folder' and name='${nombreEvento}' and '${PARENT_FOLDER_ID}' in parents and trashed=false`;
        const folderSearch = await drive.files.list({
            q: folderQuery,
            fields: 'files(id, name)'
        });

        let eventFolderId;

        if (folderSearch.data.files.length > 0) {
            eventFolderId = folderSearch.data.files[0].id;
        } else {
            // Crear la subcarpeta del evento
            const folderMetadata = {
                name: nombreEvento,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [PARENT_FOLDER_ID]
            };
            const createdFolder = await drive.files.create({
                resource: folderMetadata,
                fields: 'id'
            });
            eventFolderId = createdFolder.data.id;

            // Dar permisos de editor a tu correo personal para que la carpeta sea tuya en la práctica
            await drive.permissions.create({
                fileId: eventFolderId,
                requestBody: {
                    role: 'editor',
                    type: 'user',
                    emailAddress: YOUR_EMAIL
                }
            });
        }

        // 2. Subir el archivo usando los permisos de la carpeta del evento
        const stream = new Readable();
        stream.push(req.file.buffer);
        stream.push(null);

        const fileMetadata = {
            name: req.file.originalname,
            parents: [eventFolderId]
        };

        const media = {
            mimeType: req.file.mimetype,
            body: stream
        };

        const uploadedFile = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, name',
            supportsAllDrives: true
        });

        console.log(`¡Archivo subido con éxito a Google Drive! ID: ${uploadedFile.data.id}`);
        res.status(200).json({ success: true, message: '¡Subido con éxito a Google Drive!', fileId: uploadedFile.data.id });

    } catch (error) {
        console.error('Error al subir el archivo a Drive:', error);
        res.status(500).json({ error: 'Hubo un error al procesar el archivo en el servidor.' });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
