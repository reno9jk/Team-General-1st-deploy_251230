// Firebase 설정 파일
// Firebase Console에서 복사한 설정을 여기에 붙여넣으세요

// 🔥 여기에 Firebase 설정을 추가하세요!
// Firebase Console (https://console.firebase.google.com) > 프로젝트 설정 > 일반 > 앱 > SDK 설정 및 구성
// 에서 복사한 설정을 아래에 붙여넣으세요

const firebaseConfig = {
    // 예시 (실제 값으로 교체하세요):
    // apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    // authDomain: "your-project.firebaseapp.com",
    // projectId: "your-project-id",
    // storageBucket: "your-project.appspot.com",
    // messagingSenderId: "123456789012",
    // appId: "1:123456789012:web:abcdef1234567890"
};

// Firebase가 초기화되었는지 확인
let firebaseInitialized = false;

// Firebase 초기화 함수
function initFirebase() {
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK가 로드되지 않았습니다. index.html에서 Firebase SDK를 먼저 로드하세요.');
        return false;
    }

    // Firebase 설정이 비어있는지 확인
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes('XXXXX')) {
        console.warn('Firebase 설정이 되지 않았습니다. firebase-config.js 파일에 Firebase 설정을 추가하세요.');
        return false;
    }

    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            firebaseInitialized = true;
            console.log('Firebase 초기화 성공');
            return true;
        } else {
            firebaseInitialized = true;
            return true;
        }
    } catch (error) {
        console.error('Firebase 초기화 실패:', error);
        return false;
    }
}

// Firebase 인증 및 Firestore 가져오기
function getFirebaseServices() {
    if (!firebaseInitialized) {
        if (!initFirebase()) {
            return null;
        }
    }

    try {
        const auth = firebase.auth();
        const db = firebase.firestore();
        
        // Firestore 설정 (오프라인 지속성 활성화)
        db.enablePersistence().catch((err) => {
            if (err.code == 'failed-precondition') {
                console.warn('Firestore 오프라인 지속성을 활성화할 수 없습니다. 여러 탭이 열려있을 수 있습니다.');
            } else if (err.code == 'unimplemented') {
                console.warn('브라우저가 Firestore 오프라인 지속성을 지원하지 않습니다.');
            }
        });
        
        return { auth, db };
    } catch (error) {
        console.error('Firebase 서비스 가져오기 실패:', error);
        return null;
    }
}

// 페이지 로드 시 Firebase 초기화 시도
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        initFirebase();
    });
}

