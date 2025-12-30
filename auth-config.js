// 인증 설정 파일
// 이 서비스는 특정 사용자(석장군)만 사용할 수 있습니다

const AUTH_CONFIG = {
    // 허용된 사용자 이메일 주소
    // ⚠️ 여기에 본인의 이메일 주소를 입력하세요 ⚠️
    allowedEmail: 'reno9jk@gmail.com', // ← 이 부분을 본인의 실제 이메일 주소로 변경하세요!
    
    // 또는 Firebase 사용자 UID를 직접 지정하려면:
    // allowedUserId: 'your-firebase-user-uid-here'
};

// 이메일 유효성 검사 (간단한 형식 체크)
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// 허용된 사용자인지 확인
function isAllowedUser(user) {
    if (!user) return false;
    
    // 이메일로 확인
    if (AUTH_CONFIG.allowedEmail && user.email) {
        return user.email.toLowerCase() === AUTH_CONFIG.allowedEmail.toLowerCase();
    }
    
    // UID로 확인 (선택사항)
    if (AUTH_CONFIG.allowedUserId) {
        return user.uid === AUTH_CONFIG.allowedUserId;
    }
    
    return false;
}

