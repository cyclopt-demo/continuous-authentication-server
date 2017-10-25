export class AdminDashboard {

    // Users stuff
    totalUsers_genStat?: number;
    totalSessions_genStat?: number;
    totalKeystrokes_genStat?: number;
    latestSession_genStat?: string;
    totalRejections_genStat?: number;


    // Users stuff
    userStatistics?: Array<
    {   id: string,
        total_keystrokes: number,
        is_trained: boolean,
        min: number,
        max: number,
        avg: number,
        std: number,
        fastest_di: string,
        slowest_di: string,
        rejections: number
    }> = [];
}
