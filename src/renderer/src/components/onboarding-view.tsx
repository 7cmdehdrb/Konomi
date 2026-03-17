import { FolderPlus, Images, Search, Sparkles, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OnboardingViewProps {
  onAddFolder: () => void;
}

const features = [
  {
    icon: Search,
    title: "프롬프트 검색",
    description: "이미지에 포함된 프롬프트를 자동으로 추출하고 검색할 수 있습니다",
  },
  {
    icon: Sparkles,
    title: "유사 이미지 탐색",
    description: "시각적 유사도와 프롬프트 유사도로 비슷한 이미지를 찾아줍니다",
  },
  {
    icon: Tags,
    title: "카테고리 관리",
    description: "이미지를 카테고리로 분류하고 즐겨찾기로 관리하세요",
  },
];

export function OnboardingView({ onAddFolder }: OnboardingViewProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
      <div className="max-w-lg space-y-8">
        {/* App icon + welcome */}
        <div className="space-y-3">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Images className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            Konomi에 오신 것을 환영합니다
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            NovelAI, Stable Diffusion 이미지의 프롬프트를 자동으로 추출하고
            <br />
            검색, 분류, 관리할 수 있는 이미지 갤러리입니다.
          </p>
        </div>

        {/* Features */}
        <div className="space-y-3 text-left">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50"
            >
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <feature.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">
                  {feature.title}
                </div>
                <div className="text-xs text-muted-foreground">
                  {feature.description}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="space-y-2">
          <Button size="lg" className="gap-2" onClick={onAddFolder}>
            <FolderPlus className="h-5 w-5" />
            이미지 폴더 추가하기
          </Button>
          <p className="text-xs text-muted-foreground">
            PNG 이미지가 있는 폴더를 추가하면 자동으로 스캔이 시작됩니다
          </p>
        </div>
      </div>
    </div>
  );
}
