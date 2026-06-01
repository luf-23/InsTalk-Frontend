const DB_NAME = 'instalk';
const DB_VERSION = 1;
const STORE_NAME = 'messages';

let dbPromise = null;

const promisifyRequest = (request) =>
    new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

export const buildConversationKey = (message, currentUserId) => {
    if (message.groupId) {
        return `g:${message.groupId}`;
    }
    const otherId = message.senderId === currentUserId
        ? message.receiverId
        : message.senderId;
    return `f:${otherId}`;
};

const enrichMessage = (message, currentUserId) => ({
    ...message,
    conversationKey: buildConversationKey(message, currentUserId),
});

export const initMessageDb = () => {
    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('sentAt', 'sentAt', { unique: false });
                store.createIndex('conversationKey', 'conversationKey', { unique: false });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    return dbPromise;
};

const runWriteTransaction = async (callback) => {
    const db = await initMessageDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        try {
            callback(store);
        } catch (error) {
            reject(error);
            return;
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const putMessage = async (message, currentUserId) => {
    if (!message?.id) {
        return;
    }
    await runWriteTransaction((store) => {
        store.put(enrichMessage(message, currentUserId));
    });
};

export const putMessages = async (messages, currentUserId) => {
    if (!messages?.length) {
        return;
    }
    await runWriteTransaction((store) => {
        messages.forEach((message) => {
            if (message?.id) {
                store.put(enrichMessage(message, currentUserId));
            }
        });
    });
};

export const replaceAllMessages = async (messages, currentUserId) => {
    await runWriteTransaction((store) => {
        store.clear();
        (messages || []).forEach((message) => {
            if (message?.id) {
                store.put(enrichMessage(message, currentUserId));
            }
        });
    });
};

export const deleteMessage = async (messageId) => {
    if (messageId == null) {
        return;
    }
    await runWriteTransaction((store) => {
        store.delete(messageId);
    });
};

export const deleteMessages = async (messageIds) => {
    if (!messageIds?.length) {
        return;
    }
    await runWriteTransaction((store) => {
        messageIds.forEach((id) => store.delete(id));
    });
};

export const getAllMessages = async () => {
    const db = await initMessageDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    return promisifyRequest(tx.objectStore(STORE_NAME).getAll());
};

export const getLastMessage = async () => {
    const db = await initMessageDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const index = tx.objectStore(STORE_NAME).index('sentAt');
        const request = index.openCursor(null, 'prev');

        request.onsuccess = () => {
            const cursor = request.result;
            resolve(cursor ? cursor.value : null);
        };
        request.onerror = () => reject(request.error);
    });
};

export const getMessagesByConversation = async (conversationKey) => {
    const db = await initMessageDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('conversationKey');
    return promisifyRequest(index.getAll(conversationKey));
};

export const countMessages = async () => {
    const db = await initMessageDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    return promisifyRequest(tx.objectStore(STORE_NAME).count());
};

export const clearAllMessages = async () => {
    await runWriteTransaction((store) => {
        store.clear();
    });
};

/** 一次性：从 localStorage 迁移到 IndexedDB */
export const migrateMessagesFromLocalStorage = async (currentUserId) => {
    const existingCount = await countMessages();
    if (existingCount > 0) {
        return 0;
    }

    const raw = localStorage.getItem('instalk-messages');
    if (!raw) {
        return 0;
    }

    try {
        const parsed = JSON.parse(raw);
        const legacyMessages = parsed?.messages;
        if (!Array.isArray(legacyMessages) || legacyMessages.length === 0) {
            return 0;
        }

        await putMessages(legacyMessages, currentUserId);

        parsed.messages = [];
        localStorage.setItem('instalk-messages', JSON.stringify(parsed));

        console.log(`已从 localStorage 迁移 ${legacyMessages.length} 条消息到 IndexedDB`);
        return legacyMessages.length;
    } catch (error) {
        console.error('迁移 localStorage 消息到 IndexedDB 失败:', error);
        return 0;
    }
};
