# 오픈소스 · 사용한 모델 고지

Lumenism은 아래 오픈소스 라이브러리, AI 모델, 글꼴을 사용합니다. 각 저작권과 권리는 원저작자에게 있습니다.

AI 모델과 라이브러리 파일은 이 저장소에 들어 있지 않습니다. 앱을 쓸 때 각 기기가 아래 공식 배포처에서 직접 내려받아 기기 안에서만 실행합니다.

## 라이브러리

| 이름 | 만든 곳 | 라이선스 | 출처 |
|---|---|---|---|
| MediaPipe Tasks Vision | Google | Apache-2.0 | https://github.com/google-ai-edge/mediapipe |
| Transformers.js | Hugging Face | Apache-2.0 | https://github.com/huggingface/transformers.js |
| ONNX Runtime Web | Microsoft | MIT | https://github.com/microsoft/onnxruntime |

## AI 모델

| 모델 | 쓰이는 곳 | 만든 곳 | 라이선스 | 출처 |
|---|---|---|---|---|
| Face Landmarker | 얼굴 인식 · 인물 보정 | Google (MediaPipe) | Apache-2.0 | https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker |
| Selfie Multiclass Segmenter · Selfie Segmenter | 인물 · 피부 · 머리카락 · 옷 분할 | Google (MediaPipe) | Apache-2.0 | https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter |
| Magic Touch (Interactive Segmenter) | 피사체 선택 | Google (MediaPipe) | Apache-2.0 | https://ai.google.dev/edge/mediapipe/solutions/vision/interactive_segmenter |
| EfficientNet-Lite0 · EfficientDet-Lite0 | 장면 · 물체 인식 | Google (MediaPipe) | Apache-2.0 | https://ai.google.dev/edge/mediapipe/solutions/vision/image_classifier |
| YuNet (face_detection_yunet_2023mar) | 작은 얼굴 · 반측면 얼굴 찾기 | OpenCV (Shiqi Yu 외) | MIT | https://huggingface.co/opencv/face_detection_yunet |
| SegFormer-B0 (ADE20K, ONNX 변환: Xenova) | 하늘 · 건물 · 나무 · 물 · 산 분할, 하늘 교체 | NVIDIA | NVIDIA Source Code License (**비상업적 용도만 허용**) | https://github.com/NVlabs/SegFormer · https://huggingface.co/Xenova/segformer-b0-finetuned-ade-512-512 |
| Depth Anything V2 Small (ONNX: onnx-community) | 깊이 보케 · 입체 조명 | Depth Anything 팀 (HKU · TikTok) | Apache-2.0 | https://github.com/DepthAnything/Depth-Anything-V2 · https://huggingface.co/onnx-community/depth-anything-v2-small |
| CLIP ViT-B/32 (ONNX: Xenova) | 자동 태그 | OpenAI | MIT | https://github.com/openai/CLIP · https://huggingface.co/Xenova/clip-vit-base-patch32 |
| Swin2SR classical ×2 (ONNX: Xenova) | AI 2배 업스케일 | Marcos V. Conde 외 | Apache-2.0 | https://github.com/mv-lab/swin2sr · https://huggingface.co/Xenova/swin2SR-classical-sr-x2-64 |
| LaMa (ONNX: Carve) | AI 물체 지우기 | Samsung AI Center (Roman Suvorov 외) | Apache-2.0 | https://github.com/advimman/lama · https://huggingface.co/Carve/LaMa-ONNX |

> SegFormer 가중치는 NVIDIA Source Code License에 따라 비상업적 용도(연구·평가)로만 사용할 수 있습니다. Lumenism은 판매하거나 상업적으로 사용하지 않습니다.

## 글꼴 (Google Fonts)

모두 SIL Open Font License 1.1 — https://openfontlicense.org

Inter · Noto Sans KR · Noto Serif KR · Black Han Sans · Nanum Pen Script · Gowun Batang · Playfair Display · Bebas Neue

---

각 라이선스의 전문은 위 출처에서 확인할 수 있습니다. 고지에 빠진 항목이나 잘못된 내용이 있으면 알려 주세요.
