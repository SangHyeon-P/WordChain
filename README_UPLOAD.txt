한국어 끝말잇기 v2 배포 구조

GitHub 저장소 루트에 다음 구조 그대로 올리세요.

index.html
db/
  words.txt
  version.json
  patch.json
  definitions/
    000.json ... 063.json
tools/
  build_db.py   (선택: DB 재생성 도구)

일반 게임/UI 수정: index.html만 교체
단어 운영 수정: db/patch.json 편집
전체 단어 목록 수정: db/words.txt 편집
우리말샘 새 원본으로 뜻풀이 재생성: tools/build_db.py 사용

patch.json 형식 예시
{
  "add": {"새단어": ["뜻풀이"]},
  "remove": ["삭제할단어"],
  "definitions": {"기존단어": ["수정한 뜻풀이"]}
}

주의: db 폴더의 상대 경로를 바꾸면 index.html의 COMMON_DB_BASE도 함께 수정해야 합니다.
