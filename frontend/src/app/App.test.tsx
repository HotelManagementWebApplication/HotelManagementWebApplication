import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { authApi } from "../shared/api/auth";
import { apiClient, ApiError } from "../shared/api/client";

const captured=vi.hoisted(()=>({props:null as any}));
vi.mock("./navigation/ScreenRouter",()=>({ScreenRouter:(props:any)=>{captured.props=props;return null;}}));

describe("employee profile is the only routing authority",()=>{
  beforeEach(()=>{vi.restoreAllMocks();sessionStorage.clear();vi.spyOn(authApi,"employeeLogin").mockResolvedValue({access_token:"demo-access",refresh_token:"demo-refresh",token_type:"Bearer",expires_in:900,refresh_expires_in:3600});});
  it.each([403,500])("does not use demo role mapping when profile fails with %s",async status=>{
    vi.spyOn(authApi,"employeeProfile").mockRejectedValue(new ApiError(status,{message:"Hồ sơ không khả dụng"}));
    render(<App />);
    let error:string|null=null;
    await act(async()=>{error=await captured.props.onLogin("FRONTDESK","demo-pass");});
    expect(error).not.toBeNull();
    expect(apiClient.store.get()).toBeNull();
    expect(captured.props.view).not.toBe("frontdesk");
  });
  it("routes by the real profile even when the login name matches another demo role",async()=>{
    vi.spyOn(authApi,"employeeProfile").mockResolvedValue({employee_id:"REAL",full_name:"Nhân viên thật",role:"STAFF",permissions:[]});
    render(<App />);
    await act(async()=>{expect(await captured.props.onLogin("FRONTDESK","demo-pass")).toBeNull();});
    expect(captured.props.view).toBe("staff");
    expect(captured.props.role).toBe("staff");
  });
});
