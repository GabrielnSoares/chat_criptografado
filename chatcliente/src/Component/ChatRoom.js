import React, { useEffect, useState } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { enc, dec } from './crypt';

var stompClient = null;
const ChatRoom = () => {
    const [privateChats, setPrivateChats] = useState(new Map());
    const [publicChats, setPublicChats] = useState([]);
    const [tab, setTab] = useState("CHATROOM");
    const [userData, setUserData] = useState({
        username: '',
        receivername: '',
        connected: false,
        message: ''
    });
    const [blinkingTabs, setBlinkingTabs] = useState(new Set());

    useEffect(() => {
        console.log(userData);
    }, [userData]);

    const connect = () => {
        let Sock = new SockJS('http://localhost:8080/ws');
        stompClient = new Client({
            webSocketFactory: () => Sock,
            onConnect: onConnected,
            onStompError: onError,
        });
        stompClient.activate();
    }

    const onConnected = () => {
        setUserData({ ...userData, "connected": true });
        stompClient.subscribe('/chatroom/public', onMessageReceived);
        stompClient.subscribe('/user/' + userData.username + '/private', onPrivateMessage);
        userJoin();
    }

    const userJoin = () => {
        var chatMessage = {
            senderName: userData.username,
            status: "JOIN"
        };
        stompClient.publish({ destination: "/app/message", body: JSON.stringify(chatMessage) });
    }

    const onMessageReceived = (payload) => {
        var payloadData = JSON.parse(payload.body);
        switch (payloadData.status) {
            case "JOIN":
                if (!privateChats.get(payloadData.senderName)) {
                    privateChats.set(payloadData.senderName, []);
                    setPrivateChats(new Map(privateChats));
                    if (userData.username !== payloadData.senderName) {
                        userJoin();
                    }
                }
                break;
            case "MESSAGE":
                let msg = dec(payloadData.senderName, payloadData.message)
                payloadData.message = msg
                publicChats.push(payloadData);
                setPublicChats([...publicChats]);
                break;
        }
    }

    const onPrivateMessage = (payload) => {
        console.log(payload);
        var payloadData = JSON.parse(payload.body);
        let msg = dec(payloadData.senderName, payloadData.message)
        payloadData.message = msg
        if (privateChats.get(payloadData.senderName)) {
            privateChats.get(payloadData.senderName).push(payloadData);
            setPrivateChats(new Map(privateChats));
        } else {
            let list = [];
            list.push(payloadData);
            privateChats.set(payloadData.senderName, list);
            setPrivateChats(new Map(privateChats));
        }
        if (payloadData.senderName !== userData.username && tab !== payloadData.senderName) {
            setBlinkingTabs(prev => new Set(prev).add(payloadData.senderName));
        }
    }

    const onError = (err) => {
        console.log(err);
    }

    const handleMessage = (event) => {
        const { value } = event.target;
        setUserData({ ...userData, "message": value });
    }

    const sendValue = () => {
        if (stompClient && stompClient.connected) {
            var chatMessage = {
                senderName: userData.username,
                message: enc(userData.username, userData.message).toString(),
                status: "MESSAGE",
                timestamp: new Date().getTime()
            };
            console.log(chatMessage);
            stompClient.publish({ destination: "/app/message", body: JSON.stringify(chatMessage) });
            setUserData({ ...userData, "message": "" });
        }
    }

    const sendPrivateValue = () => {
        if (stompClient && stompClient.connected) {
            var chatMessage = {
                senderName: userData.username,
                receiverName: tab,
                message: enc(userData.username, userData.message).toString(),
                status: "MESSAGE",
                timestamp: new Date().getTime()
            };

            stompClient.publish({ destination: "/app/private-message", body: JSON.stringify(chatMessage) });
            if (userData.username !== tab) {
                chatMessage.message = dec(userData.username, chatMessage.message)
                privateChats.get(tab).push(chatMessage);
                setPrivateChats(new Map(privateChats));
            }
            setUserData({ ...userData, "message": "" });
        }
    }

    const handleUsername = (event) => {
        const { value } = event.target;
        setUserData({ ...userData, "username": value });
    }

    const registerUser = () => {
        connect();
    }

    const handleSubmit = (event) => {
        event.preventDefault();
        if (tab === "CHATROOM") {
            sendValue();
        } else {
            sendPrivateValue();
        }
    };

    const handleTabClick = (name) => {
        setTab(name);
        setBlinkingTabs(prev => {
            const newSet = new Set(prev);
            newSet.delete(name);
            return newSet;
        });
    }

    const handleLogout = () => {
        window.location.reload();
    }

    const handleRegisterSubmit = (event) => {
        event.preventDefault();
        registerUser();
    };

    return (
        <div className="container">
            {userData.connected ?
                <div className="chat-box">
                    <div className="member-list">
                        <div className="logo-container">
                            <img 
                                src="/logo-chat.png" 
                                alt="Logo Chat" 
                                className="chat-logo"
                            />
                            <span className="logo-text">ZapTalk!</span>
                        </div>
                        <ul>
                            {[...privateChats.keys()]
                                .filter(name => name === userData.username)
                                .map((name, index) => (
                                    <li onClick={() => { setTab(name) }} 
                                        className={`member current-user ${tab === name && "active"}`} 
                                        key={index}>
                                        {name} (Você)
                                    </li>
                                ))}
                            <li onClick={() => { setTab("CHATROOM") }} 
                                className={`member ${tab === "CHATROOM" && "active"}`}>
                                ChatRoom (Todos)
                            </li>
                            {[...privateChats.keys()]
                                .filter(name => name !== userData.username)
                                .map((name, index) => (
                                    <li 
                                        onClick={() => handleTabClick(name)} 
                                        className={`member ${tab === name && "active"} ${blinkingTabs.has(name) ? "blinking" : ""}`} 
                                        key={index}
                                    >
                                        {name}
                                    </li>
                                ))}
                        </ul>
                        <button 
                            className="logout-button" 
                            onClick={handleLogout}
                        >
                            Sair
                        </button>
                    </div>
                    {tab === "CHATROOM" && <div className="chat-content">
                        <div className="chat-header">
                            <span className="active-chat-name">Chat Público</span>
                        </div>
                        <ul className="chat-messages">
                            {publicChats.map((chat, index) => (
                                <li className={`message ${chat.senderName === userData.username && "self"}`} key={index}>
                                    {chat.senderName !== userData.username && (
                                        <div className="avatar-container">
                                            <div className="avatar">{chat.senderName}</div>
                                            <div className="message-time">
                                                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    )}
                                    <div className="message-data">{chat.message}</div>
                                    {chat.senderName === userData.username && (
                                        <div className="avatar-container self">
                                            <div className="avatar self">{chat.senderName}</div>
                                            <div className="message-time">
                                                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>

                        <form onSubmit={handleSubmit} className="send-message">
                            <input 
                                type="text" 
                                className="input-message" 
                                placeholder="Digite sua mensagem" 
                                value={userData.message} 
                                onChange={handleMessage}
                            />
                            <button 
                                type="submit" 
                                className="send-button"
                            >
                                Enviar
                            </button>
                        </form>
                    </div>}
                    {tab !== "CHATROOM" && <div className="chat-content">
                        <div className="chat-header">
                            <span className="active-chat-name">Chat com {tab}</span>
                        </div>
                        <ul className="chat-messages">
                            {[...privateChats.get(tab)].map((chat, index) => (
                                <li className={`message ${chat.senderName === userData.username && "self"}`} key={index}>
                                    {chat.senderName !== userData.username && (
                                        <div className="avatar-container">
                                            <div className="avatar">{chat.senderName}</div>
                                            <div className="message-time">
                                                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    )}
                                    <div className="message-data">{chat.message}</div>
                                    {chat.senderName === userData.username && (
                                        <div className="avatar-container self">
                                            <div className="avatar self">{chat.senderName}</div>
                                            <div className="message-time">
                                                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>

                        <form onSubmit={handleSubmit} className="send-message">
                            <input 
                                type="text" 
                                className="input-message" 
                                placeholder="Digite sua mensagem" 
                                value={userData.message} 
                                onChange={handleMessage}
                            />
                            <button 
                                type="submit" 
                                className="send-button"
                            >
                                Enviar
                            </button>
                        </form>
                    </div>}
                </div>
                :
                <div className="register">
                    <div className="register-content">
                        <img 
                            src="/logo-chat.png" 
                            alt="Logo Chat" 
                            className="register-logo"
                        />
                        <h2 className="welcome-text">Bem-vindo ao ZapTalk!</h2>
                        <p className="welcome-subtitle">Por favor, digite seu nome para começar</p>
                        <form onSubmit={handleRegisterSubmit}>
                            <input
                                id="user-name"
                                placeholder="Seu nome"
                                name="userName"
                                value={userData.username}
                                onChange={handleUsername}
                                margin="normal"
                            />
                            <button type="submit">
                                Conectar
                            </button>
                        </form>
                    </div>
                </div>}
        </div>
    )
}

export default ChatRoom;
