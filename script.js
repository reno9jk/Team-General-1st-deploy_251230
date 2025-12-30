// 프로젝트 관리 시스템 - 메인 스크립트

// 데이터 저장소 (Firebase 또는 LocalStorage 사용)
// Firebase가 사용 가능하면 FirebaseDataStore, 아니면 기존 LocalStorage 버전 사용
class DataStore {
    constructor() {
        this.projects = this.load('projects') || [];
        this.members = this.load('members') || [];
        this.milestones = this.load('milestones') || [];
    }

    load(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    }

    save(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    saveAll() {
        this.save('projects', this.projects);
        this.save('members', this.members);
        this.save('milestones', this.milestones);
    }

    // 연도별 프로젝트 필터링 (프로젝트의 year 또는 마감일 연도 기준)
    getProjectsByYear(year) {
        return this.projects.filter(project => {
            // 프로젝트에 year 필드가 있으면 사용
            if (project.year) {
                return project.year === year;
            }
            // 없으면 마감일 연도 기준
            if (project.deadline) {
                const deadlineYear = new Date(project.deadline).getFullYear();
                return deadlineYear === year;
            }
            // 마감일도 없으면 생성 연도 기준
            if (project.createdAt) {
                const createdYear = new Date(project.createdAt).getFullYear();
                return createdYear === year;
            }
            return true; // 정보가 없으면 모두 표시
        });
    }

    // 연도별 구성원 필터링 (해당 연도 프로젝트의 구성원만)
    getMembersByYear(year) {
        const yearProjects = this.getProjectsByYear(year);
        const projectIds = yearProjects.map(p => p.id);
        return this.members.filter(member => projectIds.includes(member.projectId));
    }

    // 프로젝트 CRUD
    addProject(project) {
        project.id = Date.now().toString();
        project.createdAt = new Date().toISOString();
        this.projects.push(project);
        this.saveAll();
        return project;
    }

    updateProject(id, updates) {
        const index = this.projects.findIndex(p => p.id === id);
        if (index !== -1) {
            this.projects[index] = { ...this.projects[index], ...updates };
            this.saveAll();
            return this.projects[index];
        }
        return null;
    }

    deleteProject(id) {
        this.projects = this.projects.filter(p => p.id !== id);
        this.members = this.members.filter(m => m.projectId !== id);
        this.milestones = this.milestones.filter(m => m.projectId !== id);
        this.saveAll();
    }

    getProject(id) {
        return this.projects.find(p => p.id === id);
    }

    // 구성원 CRUD
    addMember(member) {
        member.id = Date.now().toString();
        // 기본 밴드 설정
        if (!member.band) {
            member.band = 'A';
        }
        this.members.push(member);
        this.saveAll();
        return member;
    }

    updateMember(id, updates) {
        const index = this.members.findIndex(m => m.id === id);
        if (index !== -1) {
            this.members[index] = { ...this.members[index], ...updates };
            this.saveAll();
            return this.members[index];
        }
        return null;
    }

    deleteMember(id) {
        this.members = this.members.filter(m => m.id !== id);
        this.saveAll();
    }

    getMembersByProject(projectId) {
        return this.members.filter(m => m.projectId === projectId);
    }

    getMembersByBand(band) {
        if (band === 'all') return this.members;
        return this.members.filter(m => m.band === band);
    }

    getMembersByProjectAndBand(projectId, band) {
        let members = this.members.filter(m => m.projectId === projectId);
        if (band !== 'all') {
            members = members.filter(m => m.band === band);
        }
        return members;
    }

    getProjectProgress(projectId) {
        const members = this.getMembersByProject(projectId);
        if (members.length === 0) return 0;
        const total = members.reduce((sum, m) => sum + m.progress, 0);
        return Math.round(total / members.length);
    }

    // 밴드별 통계 (연도별 필터링)
    getBandStats(band, year = null) {
        let members = this.getMembersByBand(band);
        
        // 연도 필터링
        if (year) {
            const yearProjects = this.getProjectsByYear(year);
            const projectIds = yearProjects.map(p => p.id);
            members = members.filter(m => projectIds.includes(m.projectId));
        }

        const count = members.length;
        
        if (count === 0) {
            return { count: 0, avgProgress: 0, avgContribution: 0 };
        }

        const avgProgress = Math.round(members.reduce((sum, m) => sum + m.progress, 0) / count);
        const avgContribution = (members.reduce((sum, m) => sum + m.contribution, 0) / count).toFixed(1);

        return { count, avgProgress, avgContribution };
    }

    // 통계 (연도별 필터링)
    getStats(year = null) {
        const projects = year ? this.getProjectsByYear(year) : this.projects;
        const projectIds = projects.map(p => p.id);
        const members = year ? this.members.filter(m => projectIds.includes(m.projectId)) : this.members;

        const totalProjects = projects.length;
        const completedProjects = projects.filter(p => p.status === 'completed').length;
        const inProgressProjects = projects.filter(p => p.status === 'in-progress').length;
        const totalMembers = members.length;
        
        return { totalProjects, completedProjects, inProgressProjects, totalMembers };
    }

    getTopContributors(limit = 5, band = 'all', year = null) {
        let members = band === 'all' ? this.members : this.members.filter(m => m.band === band);
        
        // 연도 필터링
        if (year) {
            const yearProjects = this.getProjectsByYear(year);
            const projectIds = yearProjects.map(p => p.id);
            members = members.filter(m => projectIds.includes(m.projectId));
        }
        
        const memberScores = members.map(m => {
            const project = this.getProject(m.projectId);
            return {
                ...m,
                projectName: project ? project.name : '알 수 없음',
                score: m.contribution * (m.progress / 100)
            };
        });
        
        return memberScores
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    // 마일스톤(세부 항목) CRUD
    addMilestone(milestone) {
        milestone.id = Date.now().toString();
        milestone.createdAt = new Date().toISOString();
        this.milestones.push(milestone);
        this.saveAll();
        return milestone;
    }

    updateMilestone(id, updates) {
        const index = this.milestones.findIndex(m => m.id === id);
        if (index !== -1) {
            this.milestones[index] = { ...this.milestones[index], ...updates };
            this.saveAll();
            return this.milestones[index];
        }
        return null;
    }

    deleteMilestone(id) {
        this.milestones = this.milestones.filter(m => m.id !== id);
        this.saveAll();
    }

    getMilestonesByProject(projectId) {
        return this.milestones.filter(m => m.projectId === projectId);
    }

    getMilestone(id) {
        return this.milestones.find(m => m.id === id);
    }

    // 마일스톤의 현재 진척도 계산 (현재 월 기준)
    getMilestoneCurrentProgress(milestone) {
        const currentMonth = new Date().getMonth() + 1; // 1-12
        return milestone.monthlyProgress[currentMonth] || 0;
    }

    // 마일스톤의 전체 평균 진척도
    getMilestoneAverageProgress(milestone) {
        const values = Object.values(milestone.monthlyProgress).filter(v => v > 0);
        if (values.length === 0) return 0;
        return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    }

    // 프로젝트의 마일스톤 기반 진척도
    getProjectMilestoneProgress(projectId) {
        const milestones = this.getMilestonesByProject(projectId);
        if (milestones.length === 0) return null;
        
        const currentMonth = new Date().getMonth() + 1;
        const total = milestones.reduce((sum, m) => {
            return sum + (m.monthlyProgress[currentMonth] || 0);
        }, 0);
        
        return Math.round(total / milestones.length);
    }

    // 프로젝트 마감일까지 잔여일 계산
    getDaysRemaining(deadline) {
        if (!deadline) return null;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const deadlineDate = new Date(deadline);
        deadlineDate.setHours(0, 0, 0, 0);
        
        const diffTime = deadlineDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays;
    }

    // 종합평가 - 구성원별 전체 프로젝트 성과 집계 (프로젝트 가중치 반영, 연도별 필터링)
    getComprehensiveEvaluation(band = 'all', year = null) {
        // 연도별 필터링된 구성원 가져오기
        let membersToEvaluate = year ? this.getMembersByYear(year) : this.members;
        
        // 구성원별로 그룹화
        const memberMap = new Map();

        membersToEvaluate.forEach(member => {
            const project = this.getProject(member.projectId);
            const projectName = project ? project.name : '알 수 없음';
            const projectWeight = project ? (project.weight || 5) : 5;

            if (!memberMap.has(member.name)) {
                memberMap.set(member.name, {
                    name: member.name,
                    band: member.band,
                    projects: [],
                    roles: [],
                    weightedProgressSum: 0,
                    weightedContributionSum: 0,
                    weightedCollaborationSum: 0,
                    weightedLeadershipSum: 0,
                    weightedSkillSum: 0,
                    totalWeight: 0
                });
            }

            const data = memberMap.get(member.name);
            if (!data.projects.includes(projectName)) {
                data.projects.push(projectName);
            }
            if (member.role && !data.roles.includes(member.role)) {
                data.roles.push(member.role);
            }
            // 가중치를 적용한 합계
            data.weightedProgressSum += (member.progress || 0) * projectWeight;
            data.weightedContributionSum += (member.contribution || 0) * projectWeight;
            data.weightedCollaborationSum += (member.collaboration || 5) * projectWeight;
            data.weightedLeadershipSum += (member.leadership || 5) * projectWeight;
            data.weightedSkillSum += (member.skill || 5) * projectWeight;
            data.totalWeight += projectWeight;
        });

        // 가중 평균 계산 및 종합점수 산출
        let results = Array.from(memberMap.values()).map(data => {
            const avgProgress = data.totalWeight > 0 ? Math.round(data.weightedProgressSum / data.totalWeight) : 0;
            const avgContribution = data.totalWeight > 0 ? (data.weightedContributionSum / data.totalWeight).toFixed(1) : 0;
            const avgCollaboration = data.totalWeight > 0 ? (data.weightedCollaborationSum / data.totalWeight).toFixed(1) : 0;
            const avgLeadership = data.totalWeight > 0 ? (data.weightedLeadershipSum / data.totalWeight).toFixed(1) : 0;
            const avgSkill = data.totalWeight > 0 ? (data.weightedSkillSum / data.totalWeight).toFixed(1) : 0;

            // 종합점수: (진척도 * 0.25) + (기여도 * 2) + (협업 * 1.5) + (주도성 * 1.5) + (실력 * 2)
            // 최대 100점 기준으로 환산
            const totalScore = (
                (avgProgress * 0.25) +
                (parseFloat(avgContribution) * 2) +
                (parseFloat(avgCollaboration) * 1.5) +
                (parseFloat(avgLeadership) * 1.5) +
                (parseFloat(avgSkill) * 2)
            ).toFixed(1);

            return {
                name: data.name,
                band: data.band,
                projects: data.projects,
                roles: data.roles,
                avgProgress,
                avgContribution: parseFloat(avgContribution),
                avgCollaboration: parseFloat(avgCollaboration),
                avgLeadership: parseFloat(avgLeadership),
                avgSkill: parseFloat(avgSkill),
                totalScore: parseFloat(totalScore)
            };
        });

        // 밴드 필터링
        if (band !== 'all') {
            results = results.filter(r => r.band === band);
        }

        // 종합점수 기준 정렬
        results.sort((a, b) => b.totalScore - a.totalScore);

        // 순위 부여
        results.forEach((r, index) => {
            r.rank = index + 1;
        });

        return results;
    }

    // 종합평가 통계 (연도별 필터링)
    getEvaluationStats(year = null) {
        const members = year ? this.getMembersByYear(year) : this.members;
        const projects = year ? this.getProjectsByYear(year) : this.projects;
        const uniqueMembers = new Set(members.map(m => m.name));
        const evaluation = this.getComprehensiveEvaluation('all', year);
        const avgScore = evaluation.length > 0 
            ? (evaluation.reduce((sum, e) => sum + e.totalScore, 0) / evaluation.length).toFixed(1)
            : 0;

        return {
            totalMembers: uniqueMembers.size,
            totalProjects: projects.length,
            avgScore: avgScore
        };
    }
}

// 앱 클래스
class App {
    constructor() {
        // Firebase가 사용 가능하면 FirebaseDataStore 사용, 아니면 LocalStorage DataStore 사용
        if (typeof FirebaseDataStore !== 'undefined') {
            this.store = new FirebaseDataStore();
            // Firebase 초기화 후 데이터 변경 시 렌더링
            this.store.onDataChanged = () => {
                this.render();
            };
            // 기존 LocalStorage 데이터 마이그레이션 (한 번만 실행)
            this.migrateDataOnce();
        } else {
            this.store = new DataStore();
        }
        this.currentView = 'dashboard';
        this.currentProjectId = null;
        this.editingMemberId = null;
        this.currentMemberBandFilter = 'all';
        this.currentContributorBandFilter = 'all';
        this.currentContributorViewMode = 'individual'; // 'individual' 또는 'consolidated'
        this.currentProjectMemberBandFilter = 'all';
        this.currentEvalBandFilter = 'all';
        this.currentYear = 2026; // 기본 연도: 2026년
        
        this.init();
    }

    init() {
        this.initYearSelector();
        this.bindEvents();
        
        // Firebase 사용 시 초기화 대기
        if (this.store instanceof FirebaseDataStore) {
            // Firebase 초기화 대기 (최대 3초)
            let attempts = 0;
            const checkInitialized = setInterval(() => {
                attempts++;
                if (this.store.initialized || attempts > 30) {
                    clearInterval(checkInitialized);
                    this.render();
                }
            }, 100);
        } else {
            this.render();
        }
    }

    async migrateDataOnce() {
        if (this.store instanceof FirebaseDataStore) {
            // Firebase 초기화 및 사용자 인증 완료 대기
            let attempts = 0;
            const maxAttempts = 50; // 최대 5초 대기
            
            while (attempts < maxAttempts && (!this.store.initialized || !this.store.userId)) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            // 마이그레이션 완료 플래그 확인
            const migrated = localStorage.getItem('firebase_migrated');
            if (!migrated && this.store.initialized && this.store.userId) {
                const hasLocalData = localStorage.getItem('projects') || 
                                     localStorage.getItem('members') || 
                                     localStorage.getItem('milestones');
                if (hasLocalData) {
                    const confirm = window.confirm(
                        '기존 LocalStorage 데이터를 Firebase로 마이그레이션하시겠습니까?\n\n' +
                        '마이그레이션 후 PC와 스마트폰에서 동일한 데이터를 사용할 수 있습니다.'
                    );
                    if (confirm) {
                        try {
                            await this.store.migrateFromLocalStorage();
                            localStorage.setItem('firebase_migrated', 'true');
                        } catch (error) {
                            console.error('마이그레이션 실패:', error);
                            alert('데이터 마이그레이션에 실패했습니다. 다시 시도해주세요.');
                        }
                    }
                }
            }
        }
    }

    // 연도 선택기 초기화 (기본값: 2026년)
    initYearSelector() {
        const yearSelect = document.getElementById('yearSelect');
        yearSelect.value = '2026';
        this.currentYear = 2026;
    }

    bindEvents() {
        // 네비게이션
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.switchView(view);
            });
        });

        // 연도 선택
        document.getElementById('yearSelect').addEventListener('change', (e) => {
            this.currentYear = parseInt(e.target.value);
            this.render();
        });

        // 프로젝트 모달
        document.getElementById('addProjectBtn').addEventListener('click', () => this.openProjectModal());
        document.getElementById('closeProjectModal').addEventListener('click', () => this.closeProjectModal());
        document.getElementById('cancelProjectBtn').addEventListener('click', () => this.closeProjectModal());
        document.getElementById('projectForm').addEventListener('submit', (e) => this.handleProjectSubmit(e));

        // 구성원 모달
        document.getElementById('closeMemberModal').addEventListener('click', () => this.closeMemberModal());
        document.getElementById('cancelMemberBtn').addEventListener('click', () => this.closeMemberModal());
        document.getElementById('memberForm').addEventListener('submit', (e) => this.handleMemberSubmit(e));

        // 구성원 목록에서 구성원 추가 버튼
        document.getElementById('addMemberFromListBtn').addEventListener('click', () => this.openMemberModalFromList());

        // 진척도/기여도/협업기여/주도성 슬라이더
        document.getElementById('memberProgress').addEventListener('input', (e) => {
            document.getElementById('progressValue').textContent = e.target.value + '%';
        });
        document.getElementById('memberContribution').addEventListener('input', (e) => {
            document.getElementById('contributionValue').textContent = e.target.value;
        });
        document.getElementById('memberCollaboration').addEventListener('input', (e) => {
            document.getElementById('collaborationValue').textContent = e.target.value;
        });
        document.getElementById('memberLeadership').addEventListener('input', (e) => {
            document.getElementById('leadershipValue').textContent = e.target.value;
        });
        document.getElementById('memberSkill').addEventListener('input', (e) => {
            document.getElementById('skillValue').textContent = e.target.value;
        });

        // 프로젝트 상세 모달
        document.getElementById('closeProjectDetailModal').addEventListener('click', () => this.closeProjectDetailModal());
        document.getElementById('addMemberBtn').addEventListener('click', () => this.openMemberModal());
        document.getElementById('addMilestoneBtn').addEventListener('click', () => this.openMilestoneModal());

        // 마일스톤 모달
        document.getElementById('closeMilestoneModal').addEventListener('click', () => this.closeMilestoneModal());
        document.getElementById('cancelMilestoneBtn').addEventListener('click', () => this.closeMilestoneModal());
        document.getElementById('milestoneForm').addEventListener('submit', (e) => this.handleMilestoneSubmit(e));

        // 모달 외부 클릭시 닫기
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });

        // 구성원 뷰 밴드 필터
        document.querySelectorAll('#memberBandFilter .filter-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const band = e.currentTarget.dataset.band;
                this.currentMemberBandFilter = band;
                
                document.querySelectorAll('#memberBandFilter .filter-tab').forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                this.renderMembers();
            });
        });

        // 대시보드 TOP 기여자 밴드 필터
        document.querySelectorAll('#contributorBandTabs .tab-btn').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const band = e.currentTarget.dataset.band;
                this.currentContributorBandFilter = band;
                
                document.querySelectorAll('#contributorBandTabs .tab-btn').forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                this.renderTopContributors();
            });
        });

        // 대시보드 TOP 기여자 개인개별/개인통합 토글
        document.querySelectorAll('#contributorViewToggle .toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const viewMode = e.currentTarget.dataset.view;
                this.currentContributorViewMode = viewMode;
                
                document.querySelectorAll('#contributorViewToggle .toggle-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                this.renderTopContributors();
            });
        });

        // 프로젝트 상세 구성원 밴드 필터
        document.querySelectorAll('#projectMemberBandFilter .mini-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const band = e.currentTarget.dataset.band;
                this.currentProjectMemberBandFilter = band;
                
                document.querySelectorAll('#projectMemberBandFilter .mini-tab').forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                if (this.currentProjectId) {
                    const members = this.store.getMembersByProjectAndBand(this.currentProjectId, band);
                    this.renderProjectMembers(members);
                }
            });
        });

        // 종합평가 밴드 필터
        document.querySelectorAll('#evalBandFilter .filter-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const band = e.currentTarget.dataset.band;
                this.currentEvalBandFilter = band;
                
                document.querySelectorAll('#evalBandFilter .filter-tab').forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                this.renderEvaluation();
            });
        });
    }

    switchView(view) {
        this.currentView = view;
        
        // 네비게이션 버튼 활성화
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        // 뷰 전환
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(view + 'View').classList.add('active');

        // 페이지 타이틀 업데이트
        const titles = {
            dashboard: '대시보드',
            projects: '프로젝트',
            members: '구성원',
            evaluation: '종합평가'
        };
        document.querySelector('.page-title').textContent = titles[view];

        // 헤더 버튼 동적 변경
        const addProjectBtn = document.getElementById('addProjectBtn');
        const addMemberFromListBtn = document.getElementById('addMemberFromListBtn');
        
        if (view === 'members') {
            addProjectBtn.style.display = 'none';
            addMemberFromListBtn.style.display = 'inline-flex';
        } else if (view === 'evaluation') {
            addProjectBtn.style.display = 'none';
            addMemberFromListBtn.style.display = 'none';
        } else {
            addProjectBtn.style.display = 'inline-flex';
            addMemberFromListBtn.style.display = 'none';
        }

        this.render();
    }

    render() {
        switch (this.currentView) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'projects':
                this.renderProjects();
                break;
            case 'members':
                this.renderMembers();
                break;
            case 'evaluation':
                this.renderEvaluation();
                break;
        }
    }

    renderDashboard() {
        const stats = this.store.getStats(this.currentYear);
        
        // 통계 카드 업데이트
        document.getElementById('totalProjects').textContent = stats.totalProjects;
        document.getElementById('completedProjects').textContent = stats.completedProjects;
        document.getElementById('inProgressProjects').textContent = stats.inProgressProjects;
        document.getElementById('totalMembers').textContent = stats.totalMembers;

        // 밴드별 통계 업데이트
        const bandAStats = this.store.getBandStats('A', this.currentYear);
        const bandBStats = this.store.getBandStats('B', this.currentYear);

        document.getElementById('bandACount').textContent = bandAStats.count;
        document.getElementById('bandAAvgProgress').textContent = bandAStats.avgProgress + '%';
        document.getElementById('bandAAvgContribution').textContent = bandAStats.avgContribution;

        document.getElementById('bandBCount').textContent = bandBStats.count;
        document.getElementById('bandBAvgProgress').textContent = bandBStats.avgProgress + '%';
        document.getElementById('bandBAvgContribution').textContent = bandBStats.avgContribution;

        // 프로젝트 진행률 렌더링 (연도별 필터)
        const progressList = document.getElementById('projectProgressList');
        const yearProjects = this.store.getProjectsByYear(this.currentYear);
        if (yearProjects.length === 0) {
            progressList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <p>등록된 프로젝트가 없습니다</p>
                </div>
            `;
        } else {
            progressList.innerHTML = yearProjects.slice(0, 5).map(project => {
                const progress = this.store.getProjectProgress(project.id);
                return `
                    <div class="progress-item">
                        <div class="progress-item-header">
                            <span>${project.name}</span>
                            <span>${progress}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // TOP 기여자 렌더링
        this.renderTopContributors();
    }

    renderTopContributors() {
        const contributorsList = document.getElementById('topContributors');
        
        if (this.currentContributorViewMode === 'consolidated') {
            // 개인통합 모드: 같은 사람 통합
            const consolidatedContributors = this.getConsolidatedContributors(this.currentContributorBandFilter, this.currentYear);
            
            if (consolidatedContributors.length === 0) {
                contributorsList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <p>등록된 구성원이 없습니다</p>
                    </div>
                `;
            } else {
                contributorsList.innerHTML = consolidatedContributors.slice(0, 5).map(member => `
                    <div class="contributor-item consolidated">
                        <div class="contributor-avatar band-${member.band.toLowerCase()}-avatar">
                            ${member.name.charAt(0)}
                            <span class="contributor-band band-badge band-badge-${member.band.toLowerCase()} small">${member.band}</span>
                        </div>
                        <div class="contributor-info">
                            <h4>${member.name}</h4>
                            <p class="contributor-projects">${member.projects.slice(0, 2).join(', ')}${member.projects.length > 2 ? ` 외 ${member.projects.length - 2}개` : ''}</p>
                        </div>
                        <div class="contributor-score">${member.score.toFixed(1)}</div>
                    </div>
                `).join('');
            }
        } else {
            // 개인개별 모드: 프로젝트별로 개인 표시
            const topContributors = this.store.getTopContributors(5, this.currentContributorBandFilter, this.currentYear);
            
            if (topContributors.length === 0) {
                contributorsList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <p>등록된 구성원이 없습니다</p>
                    </div>
                `;
            } else {
                contributorsList.innerHTML = topContributors.map(member => `
                    <div class="contributor-item">
                        <div class="contributor-avatar band-${member.band.toLowerCase()}-avatar">
                            ${member.name.charAt(0)}
                            <span class="contributor-band band-badge band-badge-${member.band.toLowerCase()} small">${member.band}</span>
                        </div>
                        <div class="contributor-info">
                            <h4>${member.name}</h4>
                            <p>${member.projectName}</p>
                        </div>
                        <div class="contributor-score">${member.score.toFixed(1)}</div>
                    </div>
                `).join('');
            }
        }
    }

    // 개인통합 기여자 데이터 생성
    getConsolidatedContributors(band = 'all', year = null) {
        const memberMap = new Map();
        
        // 연도별 필터링된 구성원
        let membersToProcess = year ? this.store.getMembersByYear(year) : this.store.members;
        
        // 밴드 필터링
        if (band !== 'all') {
            membersToProcess = membersToProcess.filter(m => m.band === band);
        }

        membersToProcess.forEach(member => {
            const project = this.store.getProject(member.projectId);
            const projectName = project ? project.name : '알 수 없음';
            const projectWeight = project ? (project.weight || 5) : 5;
            const score = member.contribution * (member.progress / 100);

            if (!memberMap.has(member.name)) {
                memberMap.set(member.name, {
                    name: member.name,
                    band: member.band,
                    projects: [],
                    totalScore: 0,
                    totalWeight: 0
                });
            }

            const data = memberMap.get(member.name);
            if (!data.projects.includes(projectName)) {
                data.projects.push(projectName);
            }
            // 가중치 적용된 점수
            data.totalScore += score * projectWeight;
            data.totalWeight += projectWeight;
        });

        // 가중 평균 점수 계산 및 정렬
        return Array.from(memberMap.values())
            .map(data => ({
                name: data.name,
                band: data.band,
                projects: data.projects,
                score: data.totalWeight > 0 ? data.totalScore / data.totalWeight : 0
            }))
            .sort((a, b) => b.score - a.score);
    }

    renderProjects() {
        const projectList = document.getElementById('projectList');
        const yearProjects = this.store.getProjectsByYear(this.currentYear);
        
        if (yearProjects.length === 0) {
            projectList.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1;">
                    <i class="fas fa-folder-open"></i>
                    <h3>${this.currentYear}년 프로젝트가 없습니다</h3>
                    <p>새 프로젝트를 추가하여 시작하세요</p>
                </div>
            `;
            return;
        }

        const currentMonth = new Date().getMonth() + 1;

        projectList.innerHTML = yearProjects.map(project => {
            const members = this.store.getMembersByProject(project.id);
            const progress = this.store.getProjectProgress(project.id);
            const milestones = this.store.getMilestonesByProject(project.id);
            const milestoneProgress = this.store.getProjectMilestoneProgress(project.id);
            const statusLabels = {
                'planning': '기획중',
                'in-progress': '진행중',
                'completed': '완료',
                'on-hold': '보류'
            };

            const bandACnt = members.filter(m => m.band === 'A').length;
            const bandBCnt = members.filter(m => m.band === 'B').length;
            const daysRemaining = this.store.getDaysRemaining(project.deadline);

            // 잔여일 표시 텍스트 생성
            let daysRemainingHtml = '';
            if (daysRemaining !== null) {
                if (daysRemaining < 0) {
                    daysRemainingHtml = `<span class="days-remaining overdue">D+${Math.abs(daysRemaining)}</span>`;
                } else if (daysRemaining === 0) {
                    daysRemainingHtml = `<span class="days-remaining today">D-Day</span>`;
                } else if (daysRemaining <= 7) {
                    daysRemainingHtml = `<span class="days-remaining urgent">D-${daysRemaining}</span>`;
                } else if (daysRemaining <= 30) {
                    daysRemainingHtml = `<span class="days-remaining warning">D-${daysRemaining}</span>`;
                } else {
                    daysRemainingHtml = `<span class="days-remaining normal">D-${daysRemaining}</span>`;
                }
            }

            // 로드맵 미리보기 생성
            let roadmapPreview = '';
            if (milestones.length > 0) {
                const previewItems = milestones.slice(0, 3).map(m => {
                    const monthProgress = m.monthlyProgress[currentMonth] || 0;
                    return `
                        <div class="roadmap-preview-item">
                            <span class="name">${m.name}</span>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${monthProgress}%"></div>
                            </div>
                            <span class="percent">${monthProgress}%</span>
                        </div>
                    `;
                }).join('');

                roadmapPreview = `
                    <div class="project-roadmap-preview">
                        <div class="roadmap-preview-header">
                            <span><i class="fas fa-road"></i> 로드맵 (${currentMonth}월)</span>
                            <span>${milestoneProgress !== null ? milestoneProgress + '%' : '-'}</span>
                        </div>
                        <div class="roadmap-preview-items">
                            ${previewItems}
                            ${milestones.length > 3 ? `<div style="font-size: 12px; color: var(--text-secondary); text-align: center; margin-top: 4px;">+${milestones.length - 3}개 더보기</div>` : ''}
                        </div>
                    </div>
                `;
            }

            return `
                <div class="project-card" data-id="${project.id}">
                    <div class="project-card-header">
                        <div>
                            <h3>${project.name}</h3>
                            <p>${project.description || '설명 없음'}</p>
                        </div>
                        <span class="project-status status-${project.status}">${statusLabels[project.status]}</span>
                    </div>
                    <div class="project-card-body">
                        <div class="project-meta">
                            <div class="project-meta-item">
                                <i class="fas fa-calendar"></i>
                                <span>${project.deadline || '마감일 없음'}</span>
                                ${daysRemainingHtml}
                            </div>
                            <div class="project-meta-item">
                                <i class="fas fa-users"></i>
                                <span>${members.length}명</span>
                                <span class="band-badge band-badge-a small">${bandACnt}</span>
                                <span class="band-badge band-badge-b small">${bandBCnt}</span>
                            </div>
                            <div class="project-meta-item">
                                <i class="fas fa-weight-hanging"></i>
                                <span class="weight-badge weight-${project.weight || 5}">${project.weight || 5}</span>
                                <span>가중치</span>
                            </div>
                        </div>
                        <div class="project-progress">
                            <div class="project-progress-header">
                                <span>구성원 진행률</span>
                                <span>${progress}%</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${progress}%"></div>
                            </div>
                        </div>
                        <div class="project-members-preview">
                            ${members.slice(0, 4).map(m => `
                                <div class="member-avatar-small band-${m.band.toLowerCase()}-avatar">${m.name.charAt(0)}</div>
                            `).join('')}
                            ${members.length > 4 ? `<span class="member-count">+${members.length - 4}</span>` : ''}
                        </div>
                        ${roadmapPreview}
                    </div>
                </div>
            `;
        }).join('');

        // 프로젝트 카드 클릭 이벤트
        document.querySelectorAll('.project-card').forEach(card => {
            card.addEventListener('click', () => {
                this.openProjectDetail(card.dataset.id);
            });
        });
    }

    renderMembers() {
        const membersList = document.getElementById('membersList');
        
        // 구성원을 이름 기준으로 통합 (연도별 필터링)
        const consolidatedMembers = this.getConsolidatedMembers(this.currentMemberBandFilter, this.currentYear);
        
        // 필터 카운트 업데이트 (통합된 인원 수, 연도별)
        const allConsolidated = this.getConsolidatedMembers('all', this.currentYear);
        const bandAConsolidated = this.getConsolidatedMembers('A', this.currentYear);
        const bandBConsolidated = this.getConsolidatedMembers('B', this.currentYear);
        
        document.getElementById('filterCountAll').textContent = allConsolidated.length;
        document.getElementById('filterCountA').textContent = bandAConsolidated.length;
        document.getElementById('filterCountB').textContent = bandBConsolidated.length;

        if (consolidatedMembers.length === 0) {
            membersList.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1;">
                    <i class="fas fa-users"></i>
                    <h3>${this.currentYear}년 구성원이 없습니다</h3>
                    <p>프로젝트에 구성원을 추가하세요</p>
                </div>
            `;
            return;
        }

        membersList.innerHTML = consolidatedMembers.map(member => {
            // 프로젝트 목록 표시 (최대 2개 + 더보기)
            const projectsHtml = member.projects.slice(0, 2).map(p => 
                `<span class="project-tag">${p}</span>`
            ).join('') + (member.projects.length > 2 ? `<span class="project-tag more">+${member.projects.length - 2}</span>` : '');

            // 역할 목록 표시
            const rolesHtml = member.roles.length > 0 
                ? member.roles.slice(0, 2).join(', ') + (member.roles.length > 2 ? ` 외 ${member.roles.length - 2}개` : '')
                : '역할 없음';

            return `
                <div class="member-card band-${member.band.toLowerCase()}-card consolidated" onclick="app.openMemberDetailModal('${member.name}')">
                    <div class="member-card-band">
                        <span class="band-badge band-badge-${member.band.toLowerCase()}">${member.band}</span>
                        ${member.projects.length > 1 ? `<span class="project-count-badge">${member.projects.length} 프로젝트</span>` : ''}
                    </div>
                    <div class="member-avatar band-${member.band.toLowerCase()}-avatar">${member.name.charAt(0)}</div>
                    <h4>${member.name}</h4>
                    <p class="role">${rolesHtml}</p>
                    <div class="project-tags-container">${projectsHtml}</div>
                    <div class="member-stats">
                        <div class="member-stat">
                            <div class="member-stat-value">${member.avgProgress}%</div>
                            <div class="member-stat-label">평균 진척도</div>
                        </div>
                        <div class="member-stat">
                            <div class="member-stat-value">${member.avgContribution}</div>
                            <div class="member-stat-label">평균 기여도</div>
                        </div>
                        <div class="member-stat">
                            <div class="member-stat-value">${member.avgCollaboration}</div>
                            <div class="member-stat-label">평균 협업</div>
                        </div>
                        <div class="member-stat">
                            <div class="member-stat-value">${member.avgLeadership}</div>
                            <div class="member-stat-label">평균 주도성</div>
                        </div>
                        <div class="member-stat">
                            <div class="member-stat-value">${member.avgSkill}</div>
                            <div class="member-stat-label">평균 실력</div>
                        </div>
                    </div>
                    <div class="member-total-score">
                        <span class="label">종합점수</span>
                        <span class="score ${member.totalScore >= 70 ? 'high' : member.totalScore >= 50 ? 'medium' : 'low'}">${member.totalScore}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 구성원 통합 데이터 생성 (프로젝트 가중치 반영, 연도별 필터링)
    getConsolidatedMembers(band = 'all', year = null) {
        const memberMap = new Map();
        
        // 연도별 필터링된 구성원
        const membersToProcess = year ? this.store.getMembersByYear(year) : this.store.members;

        membersToProcess.forEach(member => {
            const project = this.store.getProject(member.projectId);
            const projectName = project ? project.name : '알 수 없음';
            const projectWeight = project ? (project.weight || 5) : 5;

            if (!memberMap.has(member.name)) {
                memberMap.set(member.name, {
                    name: member.name,
                    band: member.band,
                    memberIds: [],
                    projects: [],
                    projectWeights: [],
                    roles: [],
                    weightedProgressSum: 0,
                    weightedContributionSum: 0,
                    weightedCollaborationSum: 0,
                    weightedLeadershipSum: 0,
                    weightedSkillSum: 0,
                    totalWeight: 0
                });
            }

            const data = memberMap.get(member.name);
            data.memberIds.push(member.id);
            if (!data.projects.includes(projectName)) {
                data.projects.push(projectName);
                data.projectWeights.push(projectWeight);
            }
            if (member.role && !data.roles.includes(member.role)) {
                data.roles.push(member.role);
            }
            // 가중치를 적용한 합계
            data.weightedProgressSum += (member.progress || 0) * projectWeight;
            data.weightedContributionSum += (member.contribution || 0) * projectWeight;
            data.weightedCollaborationSum += (member.collaboration || 5) * projectWeight;
            data.weightedLeadershipSum += (member.leadership || 5) * projectWeight;
            data.weightedSkillSum += (member.skill || 5) * projectWeight;
            data.totalWeight += projectWeight;
        });

        // 가중 평균 계산 및 종합점수 산출
        let results = Array.from(memberMap.values()).map(data => {
            const avgProgress = data.totalWeight > 0 ? Math.round(data.weightedProgressSum / data.totalWeight) : 0;
            const avgContribution = data.totalWeight > 0 ? parseFloat((data.weightedContributionSum / data.totalWeight).toFixed(1)) : 0;
            const avgCollaboration = data.totalWeight > 0 ? parseFloat((data.weightedCollaborationSum / data.totalWeight).toFixed(1)) : 0;
            const avgLeadership = data.totalWeight > 0 ? parseFloat((data.weightedLeadershipSum / data.totalWeight).toFixed(1)) : 0;
            const avgSkill = data.totalWeight > 0 ? parseFloat((data.weightedSkillSum / data.totalWeight).toFixed(1)) : 0;

            const totalScore = parseFloat((
                (avgProgress * 0.25) +
                (avgContribution * 2) +
                (avgCollaboration * 1.5) +
                (avgLeadership * 1.5) +
                (avgSkill * 2)
            ).toFixed(1));

            return {
                name: data.name,
                band: data.band,
                memberIds: data.memberIds,
                projects: data.projects,
                roles: data.roles,
                avgProgress,
                avgContribution,
                avgCollaboration,
                avgLeadership,
                avgSkill,
                totalScore
            };
        });

        // 밴드 필터링
        if (band !== 'all') {
            results = results.filter(r => r.band === band);
        }

        // 종합점수 기준 정렬
        results.sort((a, b) => b.totalScore - a.totalScore);

        return results;
    }

    // 구성원 상세 모달 열기
    openMemberDetailModal(memberName) {
        const consolidatedMembers = this.getConsolidatedMembers('all');
        const member = consolidatedMembers.find(m => m.name === memberName);
        
        if (!member) return;

        // 해당 구성원의 모든 프로젝트별 데이터 가져오기
        const memberRecords = this.store.members.filter(m => m.name === memberName);

        let detailHtml = `
            <div class="member-detail-header">
                <div class="member-avatar-large band-${member.band.toLowerCase()}-avatar">${member.name.charAt(0)}</div>
                <div class="member-detail-info">
                    <h2>${member.name} <span class="band-badge band-badge-${member.band.toLowerCase()}">${member.band}</span></h2>
                    <p>${member.roles.join(', ') || '역할 없음'}</p>
                </div>
                <div class="member-detail-score ${member.totalScore >= 70 ? 'high' : member.totalScore >= 50 ? 'medium' : 'low'}">
                    <span class="score-value">${member.totalScore}</span>
                    <span class="score-label">종합점수</span>
                </div>
            </div>
            <div class="member-detail-stats">
                <div class="stat-item"><span class="value">${member.avgProgress}%</span><span class="label">평균 진척도</span></div>
                <div class="stat-item"><span class="value">${member.avgContribution}</span><span class="label">평균 기여도</span></div>
                <div class="stat-item"><span class="value">${member.avgCollaboration}</span><span class="label">평균 협업</span></div>
                <div class="stat-item"><span class="value">${member.avgLeadership}</span><span class="label">평균 주도성</span></div>
                <div class="stat-item"><span class="value">${member.avgSkill}</span><span class="label">평균 실력</span></div>
            </div>
            <h4 style="margin: 20px 0 12px; color: var(--text-secondary);"><i class="fas fa-folder"></i> 참여 프로젝트 (${member.projects.length}개)</h4>
            <div class="member-projects-list">
                ${memberRecords.map(record => {
                    const project = this.store.getProject(record.projectId);
                    const projectWeight = project ? (project.weight || 5) : 5;
                    return `
                        <div class="member-project-item" onclick="app.closeMemberDetailModal(); app.openMemberModal('${record.id}', true);">
                            <div class="project-info">
                                <h5>${project ? project.name : '알 수 없음'} <span class="weight-badge-small weight-${projectWeight}">${projectWeight}</span></h5>
                                <p>${record.role || '역할 없음'}</p>
                            </div>
                            <div class="project-scores">
                                <span class="mini-stat"><i class="fas fa-chart-line"></i> ${record.progress}%</span>
                                <span class="mini-stat"><i class="fas fa-star"></i> ${record.contribution}</span>
                                <span class="mini-stat"><i class="fas fa-users"></i> ${record.collaboration || 5}</span>
                                <span class="mini-stat"><i class="fas fa-lightbulb"></i> ${record.leadership || 5}</span>
                                <span class="mini-stat"><i class="fas fa-tools"></i> ${record.skill || 5}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        // 모달 표시
        let modal = document.getElementById('memberDetailModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'memberDetailModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content modal-medium">
                    <div class="modal-header">
                        <h3>구성원 상세</h3>
                        <button class="close-btn" onclick="app.closeMemberDetailModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body" id="memberDetailContent"></div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeMemberDetailModal();
            });
        }

        document.getElementById('memberDetailContent').innerHTML = detailHtml;
        modal.classList.add('active');
    }

    closeMemberDetailModal() {
        const modal = document.getElementById('memberDetailModal');
        if (modal) modal.classList.remove('active');
    }

    // 종합평가 렌더링 (연도별 필터링)
    renderEvaluation() {
        // 통계 업데이트 (연도별)
        const stats = this.store.getEvaluationStats(this.currentYear);
        document.getElementById('evalTotalMembers').textContent = stats.totalMembers;
        document.getElementById('evalTotalProjects').textContent = stats.totalProjects;
        document.getElementById('evalAvgScore').textContent = stats.avgScore;

        // 순위 테이블 렌더링 (연도별)
        const tbody = document.getElementById('evaluationRankingList');
        const evaluation = this.store.getComprehensiveEvaluation(this.currentEvalBandFilter, this.currentYear);

        if (evaluation.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" style="text-align: center; padding: 60px; color: var(--text-secondary);">
                        <i class="fas fa-trophy" style="font-size: 48px; opacity: 0.3; margin-bottom: 16px; display: block;"></i>
                        ${this.currentYear}년 평가할 구성원이 없습니다.<br>프로젝트에 구성원을 추가해주세요.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = evaluation.map(member => {
            // 순위에 따른 메달 아이콘
            let rankDisplay = '';
            if (member.rank === 1) {
                rankDisplay = '<i class="fas fa-medal" style="color: gold; font-size: 24px;"></i>';
            } else if (member.rank === 2) {
                rankDisplay = '<i class="fas fa-medal" style="color: silver; font-size: 22px;"></i>';
            } else if (member.rank === 3) {
                rankDisplay = '<i class="fas fa-medal" style="color: #cd7f32; font-size: 20px;"></i>';
            } else {
                rankDisplay = `<span class="rank-number">${member.rank}</span>`;
            }

            // 점수에 따른 색상
            let scoreClass = '';
            if (member.totalScore >= 80) {
                scoreClass = 'score-excellent';
            } else if (member.totalScore >= 60) {
                scoreClass = 'score-good';
            } else if (member.totalScore >= 40) {
                scoreClass = 'score-average';
            } else {
                scoreClass = 'score-low';
            }

            return `
                <tr class="${member.rank <= 3 ? 'top-rank' : ''}">
                    <td class="rank-col">${rankDisplay}</td>
                    <td>
                        <div class="eval-member-info">
                            <div class="member-avatar-small band-${member.band.toLowerCase()}-avatar">${member.name.charAt(0)}</div>
                            <span>${member.name}</span>
                        </div>
                    </td>
                    <td><span class="band-badge band-badge-${member.band.toLowerCase()}">${member.band}</span></td>
                    <td>
                        <div class="project-tags">
                            ${member.projects.slice(0, 2).map(p => `<span class="project-tag">${p}</span>`).join('')}
                            ${member.projects.length > 2 ? `<span class="project-tag more">+${member.projects.length - 2}</span>` : ''}
                        </div>
                    </td>
                    <td>
                        <div class="role-tags">
                            ${member.roles.slice(0, 2).map(r => `<span class="role-tag">${r}</span>`).join('')}
                            ${member.roles.length > 2 ? `<span class="role-tag more">+${member.roles.length - 2}</span>` : ''}
                            ${member.roles.length === 0 ? '<span class="role-tag empty">-</span>' : ''}
                        </div>
                    </td>
                    <td><span class="stat-value">${member.avgProgress}%</span></td>
                    <td><span class="stat-value">${member.avgContribution}</span></td>
                    <td><span class="stat-value">${member.avgCollaboration}</span></td>
                    <td><span class="stat-value">${member.avgLeadership}</span></td>
                    <td><span class="stat-value">${member.avgSkill}</span></td>
                    <td><span class="total-score ${scoreClass}">${member.totalScore}</span></td>
                </tr>
            `;
        }).join('');
    }

    // 프로젝트 모달
    openProjectModal(projectId = null) {
        const modal = document.getElementById('projectModal');
        const form = document.getElementById('projectForm');
        const title = document.getElementById('projectModalTitle');

        form.reset();
        
        if (projectId) {
            const project = this.store.getProject(projectId);
            title.textContent = '프로젝트 수정';
            document.getElementById('projectId').value = project.id;
            document.getElementById('projectName').value = project.name;
            document.getElementById('projectDescription').value = project.description || '';
            document.getElementById('projectDeadline').value = project.deadline || '';
            document.getElementById('projectStatus').value = project.status;
            document.getElementById('projectYear').value = project.year || this.currentYear;
            document.getElementById('projectWeight').value = project.weight || 5;
        } else {
            title.textContent = '새 프로젝트';
            document.getElementById('projectId').value = '';
            document.getElementById('projectYear').value = this.currentYear;
            document.getElementById('projectWeight').value = 5;
        }

        modal.classList.add('active');
    }

    closeProjectModal() {
        document.getElementById('projectModal').classList.remove('active');
    }

    handleProjectSubmit(e) {
        e.preventDefault();
        
        const id = document.getElementById('projectId').value;
        const projectData = {
            name: document.getElementById('projectName').value,
            description: document.getElementById('projectDescription').value,
            deadline: document.getElementById('projectDeadline').value,
            status: document.getElementById('projectStatus').value,
            year: parseInt(document.getElementById('projectYear').value) || this.currentYear,
            weight: parseInt(document.getElementById('projectWeight').value) || 5
        };

        if (id) {
            this.store.updateProject(id, projectData);
        } else {
            this.store.addProject(projectData);
        }

        this.closeProjectModal();
        this.render();
    }

    // 프로젝트 상세
    openProjectDetail(projectId) {
        this.currentProjectId = projectId;
        this.currentProjectMemberBandFilter = 'all';
        
        // 필터 탭 초기화
        document.querySelectorAll('#projectMemberBandFilter .mini-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('#projectMemberBandFilter .mini-tab[data-band="all"]').classList.add('active');

        const project = this.store.getProject(projectId);
        const members = this.store.getMembersByProject(projectId);
        const progress = this.store.getProjectProgress(projectId);

        const statusLabels = {
            'planning': '기획중',
            'in-progress': '진행중',
            'completed': '완료',
            'on-hold': '보류'
        };

        const bandACnt = members.filter(m => m.band === 'A').length;
        const bandBCnt = members.filter(m => m.band === 'B').length;
        const daysRemaining = this.store.getDaysRemaining(project.deadline);

        // 잔여일 표시 텍스트 생성
        let daysRemainingHtml = '';
        if (daysRemaining !== null) {
            if (daysRemaining < 0) {
                daysRemainingHtml = `<span class="days-remaining overdue">D+${Math.abs(daysRemaining)} (마감 초과)</span>`;
            } else if (daysRemaining === 0) {
                daysRemainingHtml = `<span class="days-remaining today">D-Day (오늘 마감)</span>`;
            } else if (daysRemaining <= 7) {
                daysRemainingHtml = `<span class="days-remaining urgent">D-${daysRemaining} (${daysRemaining}일 남음)</span>`;
            } else if (daysRemaining <= 30) {
                daysRemainingHtml = `<span class="days-remaining warning">D-${daysRemaining} (${daysRemaining}일 남음)</span>`;
            } else {
                daysRemainingHtml = `<span class="days-remaining normal">D-${daysRemaining} (${daysRemaining}일 남음)</span>`;
            }
        }

        document.getElementById('projectDetailTitle').textContent = project.name;
        
        document.getElementById('projectDetailInfo').innerHTML = `
            <h2>${project.name}</h2>
            <p class="description">${project.description || '설명이 없습니다.'}</p>
            <div class="project-detail-meta">
                <div class="project-detail-meta-item">
                    <i class="fas fa-flag"></i>
                    <span class="project-status status-${project.status}">${statusLabels[project.status]}</span>
                </div>
                <div class="project-detail-meta-item">
                    <i class="fas fa-calendar"></i>
                    <span>마감일: ${project.deadline || '없음'}</span>
                    ${daysRemainingHtml}
                </div>
                <div class="project-detail-meta-item">
                    <i class="fas fa-chart-line"></i>
                    <span>진행률: ${progress}%</span>
                </div>
                <div class="project-detail-meta-item">
                    <i class="fas fa-users"></i>
                    <span>구성원: ${members.length}명</span>
                    <span class="band-badge band-badge-a small" title="Band A">${bandACnt}</span>
                    <span class="band-badge band-badge-b small" title="Band B">${bandBCnt}</span>
                </div>
                <div class="project-detail-meta-item">
                    <i class="fas fa-weight-hanging"></i>
                    <span>가중치: </span>
                    <span class="weight-badge weight-${project.weight || 5}">${project.weight || 5}</span>
                </div>
            </div>
            <div style="margin-top: 16px;">
                <button class="btn btn-sm btn-secondary" onclick="app.openProjectModal('${project.id}')">
                    <i class="fas fa-edit"></i> 수정
                </button>
                <button class="btn btn-sm btn-danger" onclick="app.deleteProject('${project.id}')">
                    <i class="fas fa-trash"></i> 삭제
                </button>
            </div>
        `;

        this.renderProjectMembers(members);
        this.renderProjectRoadmap(projectId);
        document.getElementById('projectDetailModal').classList.add('active');
    }

    renderProjectRoadmap(projectId) {
        const container = document.getElementById('roadmapContainer');
        const milestones = this.store.getMilestonesByProject(projectId);
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;

        if (milestones.length === 0) {
            container.innerHTML = `
                <div class="roadmap-empty">
                    <i class="fas fa-road"></i>
                    <p>세부 항목이 없습니다. 로드맵을 추가하세요.</p>
                </div>
            `;
            return;
        }

        // 연도별로 정렬 (오래된 순)
        const sortedMilestones = [...milestones].sort((a, b) => {
            const yearA = a.year || currentYear;
            const yearB = b.year || currentYear;
            return yearA - yearB;
        });

        container.innerHTML = sortedMilestones.map(milestone => {
            const milestoneYear = milestone.year || currentYear;
            const isCurrentYear = milestoneYear === currentYear;
            const currentProgress = milestone.monthlyProgress[currentMonth] || 0;
            
            return `
                <div class="milestone-item ${isCurrentYear ? 'current-year' : ''}">
                    <div class="milestone-header">
                        <div class="milestone-info">
                            <h5>
                                <i class="fas fa-flag"></i>
                                ${milestone.name}
                                <span class="milestone-year-badge ${isCurrentYear ? 'current' : ''}">${milestoneYear}년</span>
                            </h5>
                            ${milestone.description ? `<p>${milestone.description}</p>` : ''}
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            ${isCurrentYear ? `<span class="milestone-progress-badge">${currentMonth}월: ${currentProgress}%</span>` : ''}
                            <div class="milestone-actions">
                                <button class="action-btn" onclick="app.openMilestoneModal('${milestone.id}')" title="수정">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="action-btn delete" onclick="app.deleteMilestone('${milestone.id}')" title="삭제">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="monthly-chart">
                        ${[1,2,3,4,5,6,7,8,9,10,11,12].map(month => {
                            const value = milestone.monthlyProgress[month] || 0;
                            const height = Math.max(4, value * 0.5); // 최소 4px, 최대 50px
                            const isCurrentMonthYear = isCurrentYear && month === currentMonth;
                            return `
                                <div class="month-bar" style="position: relative;">
                                    <div class="month-bar-fill" style="height: ${height}px; ${isCurrentMonthYear ? 'background: linear-gradient(180deg, var(--success), #4ade80);' : ''}"></div>
                                    <span class="month-bar-label" style="${isCurrentMonthYear ? 'color: var(--success); font-weight: 600;' : ''}">${month}월</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderProjectMembers(members) {
        const tbody = document.getElementById('projectMembersList');
        
        if (members.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                        구성원이 없습니다. 구성원을 추가하세요.
                    </td>
                </tr>
            `;
            return;
        }

        // 밴드별로 그룹화하여 표시 (A 먼저, 그 다음 B)
        const sortedMembers = [...members].sort((a, b) => {
            if (a.band === b.band) return 0;
            return a.band === 'A' ? -1 : 1;
        });

        tbody.innerHTML = sortedMembers.map(member => `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="member-avatar-small band-${member.band.toLowerCase()}-avatar">${member.name.charAt(0)}</div>
                        <div>
                            <span>${member.name}</span>
                            ${member.notes ? `<div class="table-notes" title="${member.notes}"><i class="fas fa-sticky-note"></i></div>` : ''}
                        </div>
                    </div>
                </td>
                <td>
                    <span class="band-badge band-badge-${member.band.toLowerCase()}">${member.band}</span>
                </td>
                <td>${member.role || '-'}</td>
                <td class="progress-cell">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="progress-bar" style="flex: 1;">
                            <div class="progress-fill" style="width: ${member.progress}%"></div>
                        </div>
                        <span style="min-width: 40px;">${member.progress}%</span>
                    </div>
                </td>
                <td>
                    <span class="contribution-badge">${member.contribution}</span>
                </td>
                <td>
                    <span class="score-badge collaboration">${member.collaboration || 5}</span>
                </td>
                <td>
                    <span class="score-badge leadership">${member.leadership || 5}</span>
                </td>
                <td>
                    <span class="score-badge skill">${member.skill || 5}</span>
                </td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn" onclick="app.openMemberModal('${member.id}')" title="수정">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" onclick="app.deleteMember('${member.id}')" title="삭제">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    closeProjectDetailModal() {
        document.getElementById('projectDetailModal').classList.remove('active');
        this.currentProjectId = null;
    }

    async deleteProject(projectId) {
        if (confirm('정말로 이 프로젝트를 삭제하시겠습니까?\n구성원 정보도 함께 삭제됩니다.')) {
            try {
                await this.store.deleteProject(projectId);
                this.closeProjectDetailModal();
                this.render();
            } catch (error) {
                console.error('프로젝트 삭제 실패:', error);
                alert('프로젝트 삭제에 실패했습니다. 다시 시도해주세요.');
            }
        }
    }

    // 구성원 목록에서 구성원 추가
    openMemberModalFromList() {
        this.currentProjectId = null;
        this.openMemberModal(null, true);
    }

    // 구성원 모달
    openMemberModal(memberId = null, showProjectSelect = false) {
        const modal = document.getElementById('memberModal');
        const form = document.getElementById('memberForm');
        const title = document.getElementById('memberModalTitle');
        const projectSelect = document.getElementById('memberProject');
        const projectSelectGroup = projectSelect.closest('.form-group');

        form.reset();
        document.getElementById('memberProjectId').value = this.currentProjectId || '';
        document.getElementById('progressValue').textContent = '0%';
        document.getElementById('contributionValue').textContent = '5';
        document.getElementById('collaborationValue').textContent = '5';
        document.getElementById('leadershipValue').textContent = '5';
        document.getElementById('skillValue').textContent = '5';
        
        // 기본 밴드 A 선택
        document.querySelector('input[name="memberBand"][value="A"]').checked = true;

        // 프로젝트 선택 드롭다운 채우기
        projectSelect.innerHTML = '<option value="">프로젝트 선택</option>';
        this.store.projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            projectSelect.appendChild(option);
        });

        // 프로젝트 선택 표시 여부 (구성원 목록에서 추가 시에만 표시)
        if (showProjectSelect || !this.currentProjectId) {
            projectSelectGroup.style.display = 'block';
            projectSelect.required = true;
        } else {
            projectSelectGroup.style.display = 'none';
            projectSelect.required = false;
        }
        
        if (memberId) {
            const member = this.store.members.find(m => m.id === memberId);
            title.textContent = '구성원 수정';
            document.getElementById('memberId').value = member.id;
            document.getElementById('memberName').value = member.name;
            document.getElementById('memberRole').value = member.role || '';
            document.getElementById('memberProgress').value = member.progress;
            document.getElementById('memberContribution').value = member.contribution;
            document.getElementById('memberCollaboration').value = member.collaboration || 5;
            document.getElementById('memberLeadership').value = member.leadership || 5;
            document.getElementById('memberSkill').value = member.skill || 5;
            document.getElementById('memberNotes').value = member.notes || '';
            document.getElementById('progressValue').textContent = member.progress + '%';
            document.getElementById('contributionValue').textContent = member.contribution;
            document.getElementById('collaborationValue').textContent = member.collaboration || 5;
            document.getElementById('leadershipValue').textContent = member.leadership || 5;
            document.getElementById('skillValue').textContent = member.skill || 5;
            
            // 프로젝트 선택
            projectSelect.value = member.projectId || '';
            projectSelectGroup.style.display = 'block';
            
            // 밴드 선택
            const bandRadio = document.querySelector(`input[name="memberBand"][value="${member.band || 'A'}"]`);
            if (bandRadio) bandRadio.checked = true;
            
            this.editingMemberId = memberId;
        } else {
            title.textContent = '구성원 추가';
            document.getElementById('memberId').value = '';
            document.getElementById('memberProgress').value = 0;
            document.getElementById('memberContribution').value = 5;
            document.getElementById('memberCollaboration').value = 5;
            document.getElementById('memberLeadership').value = 5;
            document.getElementById('memberSkill').value = 5;
            this.editingMemberId = null;
        }

        modal.classList.add('active');
    }

    closeMemberModal() {
        document.getElementById('memberModal').classList.remove('active');
        this.editingMemberId = null;
    }

    async handleMemberSubmit(e) {
        e.preventDefault();
        
        const id = document.getElementById('memberId').value;
        const selectedBand = document.querySelector('input[name="memberBand"]:checked').value;
        
        // 프로젝트 ID 결정 (프로젝트 상세에서 추가 시 currentProjectId, 구성원 목록에서 추가 시 select)
        let projectId = document.getElementById('memberProjectId').value;
        const projectSelect = document.getElementById('memberProject');
        if (!projectId && projectSelect.value) {
            projectId = projectSelect.value;
        }
        
        const memberData = {
            projectId: projectId,
            name: document.getElementById('memberName').value,
            role: document.getElementById('memberRole').value,
            band: selectedBand,
            progress: parseInt(document.getElementById('memberProgress').value),
            contribution: parseInt(document.getElementById('memberContribution').value),
            collaboration: parseInt(document.getElementById('memberCollaboration').value),
            leadership: parseInt(document.getElementById('memberLeadership').value),
            skill: parseInt(document.getElementById('memberSkill').value),
            notes: document.getElementById('memberNotes').value
        };

        try {
            if (id) {
                await this.store.updateMember(id, memberData);
            } else {
                await this.store.addMember(memberData);
            }
            this.closeMemberModal();
            
            // 프로젝트 상세 모달이 열려있는 경우에만 업데이트
            if (this.currentProjectId) {
                const members = this.store.getMembersByProjectAndBand(this.currentProjectId, this.currentProjectMemberBandFilter);
                this.renderProjectMembers(members);
                this.openProjectDetail(this.currentProjectId);
            } else {
                // 구성원 목록에서 추가한 경우 목록 갱신
                this.renderMembers();
            }
        } catch (error) {
            console.error('구성원 저장 실패:', error);
            alert('구성원 저장에 실패했습니다. 다시 시도해주세요.');
        }
    }

    async deleteMember(memberId) {
        if (confirm('정말로 이 구성원을 삭제하시겠습니까?')) {
            try {
                await this.store.deleteMember(memberId);
                const members = this.store.getMembersByProjectAndBand(this.currentProjectId, this.currentProjectMemberBandFilter);
                this.renderProjectMembers(members);
                this.openProjectDetail(this.currentProjectId);
            } catch (error) {
                console.error('구성원 삭제 실패:', error);
                alert('구성원 삭제에 실패했습니다. 다시 시도해주세요.');
            }
        }
    }

    // 마일스톤 모달
    openMilestoneModal(milestoneId = null) {
        const modal = document.getElementById('milestoneModal');
        const form = document.getElementById('milestoneForm');
        const title = document.getElementById('milestoneModalTitle');
        const yearSelect = document.getElementById('milestoneYear');

        form.reset();
        document.getElementById('milestoneProjectId').value = this.currentProjectId;

        // 연도 선택 드롭다운 채우기 (현재 연도 -1 ~ +3)
        const currentYear = new Date().getFullYear();
        yearSelect.innerHTML = '';
        for (let y = currentYear - 1; y <= currentYear + 3; y++) {
            const option = document.createElement('option');
            option.value = y;
            option.textContent = y + '년';
            if (y === currentYear) option.selected = true;
            yearSelect.appendChild(option);
        }

        // 월별 진척도 초기화
        for (let i = 1; i <= 12; i++) {
            document.getElementById('month' + i).value = 0;
        }

        if (milestoneId) {
            const milestone = this.store.getMilestone(milestoneId);
            title.textContent = '세부 항목 수정';
            document.getElementById('milestoneId').value = milestone.id;
            document.getElementById('milestoneName').value = milestone.name;
            document.getElementById('milestoneDescription').value = milestone.description || '';
            yearSelect.value = milestone.year || currentYear;

            // 월별 진척도 설정
            for (let i = 1; i <= 12; i++) {
                document.getElementById('month' + i).value = milestone.monthlyProgress[i] || 0;
            }
        } else {
            title.textContent = '세부 항목 추가';
            document.getElementById('milestoneId').value = '';
        }

        modal.classList.add('active');
    }

    closeMilestoneModal() {
        document.getElementById('milestoneModal').classList.remove('active');
    }

    async handleMilestoneSubmit(e) {
        e.preventDefault();

        const id = document.getElementById('milestoneId').value;
        
        // 월별 진척도 수집
        const monthlyProgress = {};
        for (let i = 1; i <= 12; i++) {
            const value = parseInt(document.getElementById('month' + i).value) || 0;
            monthlyProgress[i] = Math.min(100, Math.max(0, value));
        }

        const milestoneData = {
            projectId: document.getElementById('milestoneProjectId').value,
            name: document.getElementById('milestoneName').value,
            description: document.getElementById('milestoneDescription').value,
            year: parseInt(document.getElementById('milestoneYear').value),
            monthlyProgress: monthlyProgress
        };

        try {
            if (id) {
                await this.store.updateMilestone(id, milestoneData);
            } else {
                await this.store.addMilestone(milestoneData);
            }
            this.closeMilestoneModal();
            this.renderProjectRoadmap(this.currentProjectId);
            this.render(); // 프로젝트 카드도 업데이트
        } catch (error) {
            console.error('마일스톤 저장 실패:', error);
            alert('마일스톤 저장에 실패했습니다. 다시 시도해주세요.');
        }
    }

    async deleteMilestone(milestoneId) {
        if (confirm('정말로 이 세부 항목을 삭제하시겠습니까?')) {
            try {
                await this.store.deleteMilestone(milestoneId);
                this.renderProjectRoadmap(this.currentProjectId);
                this.render();
            } catch (error) {
                console.error('마일스톤 삭제 실패:', error);
                alert('마일스톤 삭제에 실패했습니다. 다시 시도해주세요.');
            }
        }
    }
}

// 앱 초기화
const app = new App();
