# Secrets Directory

이 폴더에는 민감한 인증 정보 파일을 저장합니다.
**이 폴더의 내용은 절대 Git에 커밋되지 않습니다.**

## Google Cloud Storage 설정

### 1. GCS 서비스 계정 키 파일 저장

GCP Console에서 다운로드한 서비스 계정 키 JSON 파일을 이 폴더에 저장하세요:

```
secrets/gcs-key.json
```

### 2. 환경 변수 설정

`.env` 파일에 다음을 추가하세요:

```env
GCS_PROJECT_ID=your-gcp-project-id
GCS_BUCKET_NAME=your-bucket-name
GCS_KEY_PATH=./secrets/gcs-key.json
```

### 3. Docker 실행

```bash
docker-compose up -d
```

## 파일 구조 예시

```
secrets/
├── README.md          # 이 파일
├── gcs-key.json       # GCS 서비스 계정 키 (직접 추가)
└── .gitkeep           # 폴더 유지용
```

## 보안 주의사항

- 이 폴더의 파일은 절대 공유하거나 Git에 커밋하지 마세요
- 키 파일이 노출되면 즉시 GCP Console에서 키를 비활성화하세요
- 프로덕션 환경에서는 Secret Manager 사용을 권장합니다
