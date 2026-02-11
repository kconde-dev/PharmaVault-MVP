# 💊 PharmaVault-MVP 
**A Serverless Pharmacy Management & Inventory System**

## 🚀 Overview
PharmaVault is a vertical software solution designed to solve inventory leakage and prescription validation errors in West African pharmaceutical markets. Built on a serverless architecture for maximum scalability and low operational cost.

## 🛠️ Technical Architecture
- **Environment:** Developed on **Pop!_OS (Linux)** 16GB RAM Workstation.
- **Backend:** Firebase (Firestore NoSQL, Auth).
- **Logic:** Python-driven data validation and inventory reconciliation.

## 💡 Engineering Rationale
I architected this project using a **NoSQL (Firestore)** schema to handle dynamic drug data hierarchies. 
* **Concurrency:** Implemented atomic transactions to prevent race conditions during inventory updates.
* **Efficiency:** Optimized data retrieval paths to ensure the system remains responsive on 4G networks (Huawei/Orange Money integration ready).
* **AI Integration:** System designed for Future RLHF-based prescription OCR parsing.

## 🚧 Status
- [x] System Architecture Design
- [x] NoSQL Schema Implementation
- [ ] AI Prescription Validation (In Development)
